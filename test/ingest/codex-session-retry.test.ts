import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createSenseiWatchStorageBindings } from "../../src/ingest/watch-storage.js";
import { createStoredService } from "./owned-service.fixture.js";
import {
	createRealIngestFixture,
	legacyFixtureRoot,
} from "./real-ingest.fixture.js";

for (const mode of ["full transcript", "appended last line"] as const) {
	test(`${mode} retries a failed final session callback from a nonzero cursor`, async () => {
		const f = createRealIngestFixture(false);
		try {
			const file = join(f.roots.codex, "transcript.jsonl");
			const text = readFileSync(
				join(legacyFixtureRoot, "codex/transcript.jsonl"),
				"utf8",
			);
			const lines = text.trimEnd().split("\n");
			const prefix = `${lines.slice(0, -1).join("\n")}\n`;
			const beforeFinalLine = Buffer.byteLength(prefix);
			const eof = Buffer.byteLength(text);
			const cursor = () =>
				f.storage.ingestState.getCursor("codex", f.roots.codex, file);
			if (mode === "appended last line") {
				writeFileSync(file, prefix);
				await createStoredService(f).scanNow();
				expect(cursor()?.byteOffset).toBe(beforeFinalLine);
				appendFileSync(file, `${lines.at(-1)}\n`);
			} else {
				writeFileSync(file, text);
			}

			const bindings = createSenseiWatchStorageBindings(f.storage);
			const persistSession = bindings.onObservedSession;
			if (!persistSession) throw new Error("Missing session storage binding");
			let attempts = 0;
			let delivered = 0;
			const service = () =>
				createStoredService(f, {
					async onObservedSession(record) {
						expect(record.observedSession.sessionId).toBe("legacy-codex");
						expect(record.cursor?.byteOffset).toBe(eof);
						expect(cursor()?.byteOffset ?? 0).toBeLessThan(eof);
						attempts += 1;
						if (attempts <= 2) throw new Error("final session write failed");
						await persistSession(record);
						delivered += 1;
					},
				});

			// Each pass creates a new service and restores parser state from SQLite.
			for (let attempt = 1; attempt <= 2; attempt += 1) {
				await expect(service().scanNow()).rejects.toThrow(
					"final session write failed",
				);
				expect(attempts).toBe(attempt);
				expect(delivered).toBe(0);
				expect(cursor()?.byteOffset).toBe(beforeFinalLine);
				expect(cursor()?.byteOffset).toBeGreaterThan(0);
			}

			await service().scanNow();
			expect(attempts).toBe(3);
			expect(delivered).toBe(1);
			expect(cursor()?.byteOffset).toBe(eof);
			expect(cursor()?.line).toBe(lines.length);
			// Once the entire group succeeds, unchanged EOF must stay idle.
			await service().scanNow();
			expect(delivered).toBe(1);
			expect(f.storage.ingestState.listWarnings()).toEqual([]);
			expect(
				f.storage.database.query("SELECT count(*) AS count FROM turns").get(),
			).toEqual({ count: 2 });
			expect(
				f.storage.database
					.query("SELECT count(*) AS count FROM tool_events")
					.get(),
			).toEqual({ count: 2 });
		} finally {
			f.cleanup();
		}
	});
}

test("version-1 Codex EOF cursors visibly replay final session delivery once", async () => {
	const f = createRealIngestFixture(false);
	try {
		const file = join(f.roots.codex, "transcript.jsonl");
		writeFileSync(
			file,
			readFileSync(join(legacyFixtureRoot, "codex/transcript.jsonl")),
		);
		await createStoredService(f).scanNow();
		const old = f.storage.ingestState.getCursor("codex", f.roots.codex, file);
		if (!old) throw new Error("Missing persisted cursor");
		f.storage.ingestState.setCursor({
			...old,
			metadata: { ...old.metadata, senseiReaderVersion: "codex/transcript/1" },
		});
		let deliveries = 0;
		const service = () =>
			createStoredService(f, {
				onRecord(record) {
					if (record.kind === "session") deliveries += 1;
				},
			});
		await service().scanNow();
		expect(deliveries).toBe(1);
		expect(f.storage.ingestState.listWarnings().map((w) => w.code)).toEqual([
			"cursor-reset",
		]);
		const current = f.storage.ingestState.getCursor(
			"codex",
			f.roots.codex,
			file,
		);
		expect(current?.metadata?.senseiReaderVersion).toBe("codex/transcript/2");
		expect(current?.byteOffset).toBe(old.byteOffset);
		await service().scanNow();
		expect(deliveries).toBe(1);
		expect(
			f.storage.database.query("SELECT count(*) AS count FROM turns").get(),
		).toEqual({ count: 2 });
		expect(
			f.storage.database.query("SELECT count(*) AS count FROM sessions").get(),
		).toEqual({ count: 1 });
	} finally {
		f.cleanup();
	}
});
