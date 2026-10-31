import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { expect, test } from "vitest";
import { decodeArchive } from "../../src/ingest/files/archive.js";
import { currentFixture } from "./current-ingest.fixture.js";

test("missing decoder is explicit; cancellation terminates a running decoder and removes signal listeners", async () => {
	const f = currentFixture(false);
	const originalPath = process.env.PATH;
	const interrupts = process.listenerCount("SIGINT");
	const terminations = process.listenerCount("SIGTERM");
	try {
		const bin = join(f.root, "bin");
		mkdirSync(bin);
		process.env.PATH = bin;
		await expect(decodeArchive(join(f.root, "missing.zst"))).rejects.toThrow(
			"ENOENT",
		);
		const pidFile = join(f.root, "decoder.pid");
		writeFileSync(
			join(bin, "zstd"),
			`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.stdout.write('{}\\n');setInterval(()=>{},1000);\n`,
			{ mode: 0o700 },
		);
		const controller = new AbortController();
		const decoded = decodeArchive(
			join(f.root, "source.zst"),
			controller.signal,
		);
		// Register rejection handling before cancellation, without swallowing failures.
		const rejected = expect(decoded).rejects.toThrow();
		for (let attempt = 0; attempt < 100 && !existsSync(pidFile); attempt++)
			await setTimeout(10);
		expect(existsSync(pidFile)).toBe(true);
		const pid = Number(readFileSync(pidFile, "utf8"));
		controller.abort();
		await rejected;
		expect(() => process.kill(pid, 0)).toThrow();
		expect(process.listenerCount("SIGINT")).toBe(interrupts);
		expect(process.listenerCount("SIGTERM")).toBe(terminations);
	} finally {
		process.env.PATH = originalPath;
		f.cleanup();
	}
});
