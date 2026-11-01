import {
	appendFileSync,
	readFileSync,
	writeFileSync,
	copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";
import { runSenseiIngestScanCommand } from "../../src/ingest/scan-command.js";
import {
	currentFixture,
	expected,
	fixtureRoot,
} from "./current-ingest.fixture.js";

test("public scan preserves independently frozen visible identities, outcomes and exclusions; replay converges", async () => {
	const f = currentFixture();
	copyFileSync(
		join(fixtureRoot, "codex-capitalized-message.jsonl"),
		join(f.codex, "session.jsonl"),
	);
	try {
		const result = await runSenseiIngestScanCommand(f.config);
		expect(result.coverage?.humanMessages).toBe(4);
		expect(result.coverage?.partial).toBe(2);
		const db = f.open();
		try {
			for (const provider of ["codex", "copilot"]) {
				const oracle = expected[provider];
				const records = db.evidence.list(provider, oracle.sessionId) as {
					observation_json: string;
				}[];
				const items = records.map((r) => JSON.parse(r.observation_json));
				expect(
					items
						.filter((x) => x.kind !== "tool")
						.map((x) => [x.itemId, x.kind, x.text]),
				).toEqual(oracle.messages);
				expect(
					items
						.filter((x) => x.kind === "tool")
						.map((x) => [x.itemId, x.outcome, x.text]),
				).toEqual(oracle.tools);
				expect(items.every((x) => x.turnId === oracle.turnId)).toBe(true);
				for (const excluded of expected.excludes)
					expect(JSON.stringify(records)).not.toContain(excluded);
			}
			expect(
				db.database
					.query(
						"SELECT count(*) AS count FROM evidence_locations WHERE length(source_digest)=64 AND line>0",
					)
					.get(),
			).toEqual({ count: 11 });
			expect(
				db.conversations.getTurn("codex", "fixture-thread", "fixture-turn")
					?.input?.prompt,
			).toBe(expected.codex.messages[0][2]);
			const before = db.database
				.query("SELECT * FROM evidence_observations ORDER BY evidence_id")
				.all();
			await runSenseiIngestScanCommand(f.config);
			expect(
				db.database
					.query("SELECT * FROM evidence_observations ORDER BY evidence_id")
					.all(),
			).toEqual(before);
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

test("compressed and plain copies converge and retain both locators; corrupt archive publishes nothing", async () => {
	const f = currentFixture(false);
	try {
		const file = join(f.codex, "session.jsonl");
		copyFileSync(join(fixtureRoot, "codex.jsonl"), file);
		const zipped = spawnSync("zstd", ["-q", "-c", "--", file]);
		expect(zipped.status).toBe(0);
		writeFileSync(`${file}.zst`, zipped.stdout);
		await runSenseiIngestScanCommand(f.config);
		const db = f.open();
		try {
			expect(db.evidence.list("codex", "fixture-thread")).toHaveLength(6);
			expect(
				db.database
					.query("SELECT count(*) AS count FROM evidence_locations")
					.get(),
			).toEqual({ count: 12 });
			const count = db.database
				.query("SELECT count(*) AS count FROM evidence_sources")
				.get();
			writeFileSync(
				join(f.codex, "corrupt.jsonl.zst"),
				zipped.stdout.subarray(0, -8),
			);
			await expect(runSenseiIngestScanCommand(f.config)).rejects.toThrow();
			expect(
				db.database
					.query("SELECT count(*) AS count FROM evidence_sources")
					.get(),
			).toEqual(count);
			expect(
				db.ingestState.getCursor(
					"codex",
					f.codex,
					join(f.codex, "corrupt.jsonl.zst"),
				),
			).toBeNull();
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});

for (const provider of ["codex", "copilot"] as const)
	test(`${provider} partial tail survives restart and failed evidence storage cannot advance its cursor`, async () => {
		const f = currentFixture(false);
		try {
			const file = join(
				f[provider],
				provider === "codex" ? "session.jsonl" : "events.jsonl",
			);
			const lines = readFileSync(
				join(fixtureRoot, `${provider}.jsonl`),
				"utf8",
			).split("\n");
			// Keep enough prefix to identify the source and rich format, then split a visible record.
			const index = provider === "codex" ? 4 : 4;
			const prefix = `${lines.slice(0, index).join("\n")}\n`;
			writeFileSync(file, prefix + lines[index].slice(0, 20));
			await runSenseiIngestScanCommand(f.config);
			const db = f.open();
			try {
				const before = db.ingestState.getCursor(provider, f[provider], file);
				expect(before?.byteOffset).toBe(Buffer.byteLength(prefix));
				appendFileSync(file, `${lines[index].slice(20)}\n`);
				db.database.exec(
					"CREATE TRIGGER reject_evidence BEFORE INSERT ON evidence_observations BEGIN SELECT RAISE(ABORT,'injected evidence failure'); END",
				);
				await expect(runSenseiIngestScanCommand(f.config)).rejects.toThrow(
					"injected evidence failure",
				);
				expect(db.ingestState.getCursor(provider, f[provider], file)).toEqual(
					before,
				);
				db.database.exec("DROP TRIGGER reject_evidence");
				await runSenseiIngestScanCommand(f.config);
				expect(
					db.ingestState.getCursor(provider, f[provider], file)?.byteOffset,
				).toBe(Buffer.byteLength(prefix + lines[index] + "\n"));
				expect(
					db.evidence.list(provider, expected[provider].sessionId),
				).toHaveLength(2);
			} finally {
				db.close();
			}
		} finally {
			f.cleanup();
		}
	});
