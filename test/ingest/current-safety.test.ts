import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";
import { runSenseiIngestScanCommand } from "../../src/ingest/scan-command.js";
import { createSenseiIngestWatch } from "../../src/ingest/watch.js";
import { currentFixture, fixtureRoot } from "./current-ingest.fixture.js";

test("changed sources preserve immutable observations and advance only committed source generations", async () => {
	const f = currentFixture();
	try {
		await runSenseiIngestScanCommand(f.config);
		const db = f.open();
		try {
			const old = db.database
				.query("SELECT * FROM evidence_observations ORDER BY evidence_id")
				.all();
			const generation = () =>
				(
					db.database
						.query("SELECT source_generation AS n FROM evidence_state")
						.get() as { n: number }
				).n;
			const first = generation();
			const file = join(f.codex, "session.jsonl");
			writeFileSync(
				file,
				readFileSync(file, "utf8").replace(
					"Find related completed tasks and show supporting evidence.",
					"Find the revised supporting evidence.",
				),
			);
			db.database.exec(
				"CREATE TRIGGER reject_evidence BEFORE INSERT ON evidence_observations BEGIN SELECT RAISE(ABORT,'reject replacement'); END",
			);
			await expect(runSenseiIngestScanCommand(f.config)).rejects.toThrow(
				"reject replacement",
			);
			expect(generation()).toBe(first);
			expect(
				db.database
					.query("SELECT * FROM evidence_observations ORDER BY evidence_id")
					.all(),
			).toEqual(old);
			db.database.exec("DROP TRIGGER reject_evidence");
			await runSenseiIngestScanCommand(f.config);
			expect(generation()).toBeGreaterThan(first);
			const now = db.database
				.query("SELECT * FROM evidence_observations ORDER BY evidence_id")
				.all();
			expect(now).toHaveLength(old.length + 1);
			for (const observation of old) expect(now).toContainEqual(observation);
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

test("archive publication is atomic even when storage fails after multiple batches", async () => {
	const f = currentFixture(false);
	try {
		const base = readFileSync(join(fixtureRoot, "codex.jsonl"), "utf8")
			.trimEnd()
			.split("\n");
		const item = JSON.parse(base[3]);
		const rows = base.slice(0, 3);
		for (let n = 0; n < 205; n++) {
			item.payload.item.id = `item-${n}`;
			rows.push(JSON.stringify(item));
		}
		const plain = join(f.root, "source.jsonl");
		writeFileSync(plain, `${rows.join("\n")}\n`);
		const compressed = spawnSync("zstd", ["-q", "-c", "--", plain]);
		expect(compressed.status).toBe(0);
		const file = join(f.codex, "session.jsonl.zst");
		writeFileSync(file, compressed.stdout);
		const db = f.open();
		try {
			db.database.exec(
				"CREATE TRIGGER reject_late BEFORE INSERT ON evidence_observations WHEN NEW.item_id='item-150' BEGIN SELECT RAISE(ABORT,'late failure'); END",
			);
			await expect(runSenseiIngestScanCommand(f.config)).rejects.toThrow(
				"late failure",
			);
			expect(
				db.database
					.query("SELECT count(*) AS n FROM evidence_observations")
					.get(),
			).toEqual({ n: 0 });
			expect(
				db.database.query("SELECT count(*) AS n FROM sessions").get(),
			).toEqual({ n: 0 });
			expect(db.ingestState.getCursor("codex", f.codex, file)).toBeNull();
			db.database.exec("DROP TRIGGER reject_late");
			await runSenseiIngestScanCommand(f.config);
			expect(db.evidence.list("codex", "fixture-thread")).toHaveLength(205);
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

test("public watch stores current evidence and reports metadata-only Copilot sessions as unavailable", async () => {
	const f = currentFixture(false);
	const db = f.open();
	const watch = createSenseiIngestWatch(f.config, { storage: db });
	try {
		mkdirSync(join(f.copilot, "metadata-only"));
		writeFileSync(
			join(f.copilot, "metadata-only", "workspace.yaml"),
			"sessionId: missing\n",
		);
		const scan = await runSenseiIngestScanCommand(f.config);
		expect(
			scan.coverage?.diagnostics.some((x) => x.includes("no events.jsonl")),
		).toBe(true);
		await watch.start();
		copyFileSync(
			join(fixtureRoot, "copilot.jsonl"),
			join(f.copilot, "events.jsonl"),
		);
		await watch.reconcileNow();
		expect(db.evidence.list("copilot", "cp-session")).toHaveLength(5);
		await watch.reconcileNow();
		expect(db.evidence.list("copilot", "cp-session")).toHaveLength(5);
	} finally {
		await watch.stop();
		db.close();
		f.cleanup();
	}
});

test("model-input user envelopes cannot become human requests without source provenance", async () => {
	const f = currentFixture(false);
	try {
		writeFileSync(
			join(f.codex, "session.jsonl"),
			readFileSync(join(fixtureRoot, "codex.jsonl"), "utf8")
				.split("\n")
				.slice(0, 3)
				.join("\n") + "\n",
		);
		const scan = await runSenseiIngestScanCommand(f.config);
		expect(scan.coverage?.partial).toBe(1);
		const db = f.open();
		try {
			expect(
				db.database.query("SELECT count(*) AS n FROM turns").get(),
			).toEqual({ n: 0 });
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

test("failed later plain batch resumes from the last atomic cursor without losing messages", async () => {
	const f = currentFixture(false);
	try {
		const base = readFileSync(join(fixtureRoot, "codex.jsonl"), "utf8")
			.trimEnd()
			.split("\n");
		const item = JSON.parse(base[3]);
		const rows = base.slice(0, 3);
		for (let n = 0; n < 205; n++) {
			item.payload.item.id = `plain-${n}`;
			rows.push(JSON.stringify(item));
		}
		const file = join(f.codex, "session.jsonl");
		writeFileSync(file, `${rows.join("\n")}\n`);
		const db = f.open();
		try {
			db.database.exec(
				"CREATE TRIGGER reject_late BEFORE INSERT ON evidence_observations WHEN NEW.item_id='plain-150' BEGIN SELECT RAISE(ABORT,'late failure'); END",
			);
			await expect(runSenseiIngestScanCommand(f.config)).rejects.toThrow(
				"late failure",
			);
			const cursor = db.ingestState.getCursor("codex", f.codex, file);
			expect(cursor?.byteOffset).toBeGreaterThan(0);
			expect(cursor?.byteOffset).toBeLessThan(
				Buffer.byteLength(rows.slice(0, 154).join("\n")),
			);
			expect(
				db.database.query("SELECT availability FROM evidence_sources").get(),
			).toEqual({ availability: "partial" });
			const saved = db.evidence.list("codex", "fixture-thread").length;
			expect(saved).toBeGreaterThan(0);
			expect(saved).toBeLessThan(151);
			db.database.exec("DROP TRIGGER reject_late");
			await runSenseiIngestScanCommand(f.config);
			expect(db.evidence.list("codex", "fixture-thread")).toHaveLength(205);
			expect(
				db.database.query("SELECT availability FROM evidence_sources").get(),
			).toEqual({ availability: "available" });
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

test("a fresh scan observes missing source generations and restores them without deleting old evidence", async () => {
	const f = currentFixture();
	try {
		await runSenseiIngestScanCommand(f.config);
		const db = f.open();
		try {
			const { renameSync } = await import("node:fs");
			const file = join(f.codex, "session.jsonl");
			const moved = join(f.root, "retained.jsonl");
			const before = db.evidence.list("codex", "fixture-thread");
			renameSync(file, moved);
			await runSenseiIngestScanCommand(f.config);
			expect(
				db.database
					.query("SELECT availability FROM evidence_sources WHERE file_path=?")
					.get(file),
			).toEqual({ availability: "unavailable" });
			expect(db.evidence.list("codex", "fixture-thread")).toEqual(before);
			renameSync(moved, file);
			await runSenseiIngestScanCommand(f.config);
			expect(
				db.database
					.query("SELECT availability FROM evidence_sources WHERE file_path=?")
					.get(file),
			).toEqual({ availability: "partial" });
			expect(db.evidence.list("codex", "fixture-thread")).toEqual(before);
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

test("cancelled file-change observations retain cancellation rather than success", async () => {
	const f = currentFixture(false);
	try {
		const lines = readFileSync(join(fixtureRoot, "codex.jsonl"), "utf8")
			.trimEnd()
			.split("\n")
			.slice(0, 4);
		lines.push(
			JSON.stringify({
				type: "event_msg",
				timestamp: "2026-10-01T00:00:01Z",
				payload: {
					type: "item_completed",
					thread_id: "fixture-thread",
					turn_id: "fixture-turn",
					item: {
						type: "FileChange",
						id: "cancelled-patch",
						status: "cancelled",
						stdout: "",
						stderr: "Cancelled by operator",
					},
				},
			}),
		);
		writeFileSync(join(f.codex, "session.jsonl"), `${lines.join("\n")}\n`);
		await runSenseiIngestScanCommand(f.config);
		const db = f.open();
		try {
			expect(
				db.database
					.query(
						"SELECT outcome FROM tool_events WHERE tool_call_id='cancelled-patch'",
					)
					.get(),
			).toEqual({ outcome: "cancelled" });
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});
