import { decoderSignals } from "./decoder-signals.js";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

/** Decode privately. No record or cursor is exposed before successful process exit. */
export async function decodeArchive(filePath: string, signal?: AbortSignal) {
	const directory = await mkdtemp(join(tmpdir(), "sensei-zstd-"));
	const path = join(directory, "decoded.jsonl");
	const cleanup = () => rm(directory, { recursive: true, force: true });
	const cancellation = decoderSignals(signal);
	const child = spawn("zstd", ["-d", "-c", "--", filePath], {
		stdio: ["ignore", "pipe", "pipe"],
		signal: cancellation.signal,
	});
	let stderr = "";
	child.stderr.on("data", (chunk) => {
		stderr = (stderr + String(chunk)).slice(-8192);
	});
	const exited = new Promise<void>((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) =>
			code === 0
				? resolve()
				: reject(new Error(`zstd failed (${code ?? signal}): ${stderr}`)),
		);
	});
	const closed = new Promise<void>((resolve) =>
		child.once("close", () => resolve()),
	);
	const writing = pipeline(
		child.stdout,
		createWriteStream(path, { mode: 0o600 }),
	);
	try {
		await Promise.all([exited, writing]);
		return { path, cleanup };
	} catch (error) {
		child.kill();
		await Promise.allSettled([exited, writing, closed]);
		await cleanup();
		throw error;
	} finally {
		cancellation.dispose();
	}
}
