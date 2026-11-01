import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runSenseiIngestScanCommand } from "../../src/ingest/scan-command.js";
import { currentFixture, fixtureRoot } from "./current-ingest.fixture.js";

const transcript = readFileSync(join(fixtureRoot, "codex.jsonl"), "utf8");
const lines = transcript.trimEnd().split("\n");

for (const prefixLines of [1, 3]) {
	test(`Codex rich-item append after ${prefixLines} legacy lines retries failed publication and converges after restart`, async () => {
		const f = currentFixture(false);
		const control = currentFixture(false);
		try {
			const file = join(f.codex, "session.jsonl");
			const prefix = `${lines.slice(0, prefixLines).join("\n")}\n`;
			writeFileSync(file, prefix);
			await runSenseiIngestScanCommand(f.config);
			const db = f.open();
			try {
				const before = db.ingestState.getCursor("codex", f.codex, file);
				expect(before?.byteOffset).toBe(Buffer.byteLength(prefix));
				expect(before?.metadata?.currentFormat).toBeUndefined();
				appendFileSync(file, transcript.slice(prefix.length));
				db.database.exec(
					"CREATE TRIGGER reject_evidence BEFORE INSERT ON evidence_observations BEGIN SELECT RAISE(ABORT,'transition write failure'); END",
				);
				await expect(runSenseiIngestScanCommand(f.config)).rejects.toThrow(
					"transition write failure",
				);
				expect(db.ingestState.getCursor("codex", f.codex, file)).toEqual(before);
				expect(db.evidence.list("codex", "fixture-thread")).toEqual([]);
				db.database.exec("DROP TRIGGER reject_evidence");
				await runSenseiIngestScanCommand(f.config);
				const observed = db.evidence.list("codex", "fixture-thread");
				expect(observed).toHaveLength(6);
				await runSenseiIngestScanCommand(f.config);
				expect(db.evidence.list("codex", "fixture-thread")).toEqual(observed);
				writeFileSync(join(control.codex, "session.jsonl"), transcript);
				await runSenseiIngestScanCommand(control.config);
				const fresh = control.open();
				try {
					expect(observed).toEqual(fresh.evidence.list("codex", "fixture-thread"));
				} finally {
					fresh.close();
				}
			} finally {
				db.close();
			}
		} finally {
			f.cleanup();
			control.cleanup();
		}
	});
}

test("version-3 EOF cursor from a failed format transition visibly replays missing evidence", async () => {
	const f = currentFixture(false);
	try {
		const file = join(f.codex, "session.jsonl");
		writeFileSync(file, `${lines.slice(0, 3).join("\n")}\n`);
		await runSenseiIngestScanCommand(f.config);
		writeFileSync(file, transcript);
		const db = f.open();
		try {
			const prior = db.ingestState.getCursor("codex", f.codex, file);
			if (!prior) throw new Error("Missing prefix cursor");
			const digest = createHash("sha256").update(transcript).digest("hex");
			// State reproduced by CR-INGEST-001 on reader v3: EOF with no session identity.
			db.ingestState.setCursor({
				...prior,
				byteOffset: Buffer.byteLength(transcript),
				line: lines.length,
				continuityToken: digest,
				metadata: {
					currentState: { turnId: "fixture-turn", partialCoverage: true },
					currentFormat: true,
					senseiEndedAtNewline: true,
					sha256: digest,
					archive: false,
					senseiReaderVersion: "codex/transcript/3",
				},
			});
			await runSenseiIngestScanCommand(f.config);
			expect(db.evidence.list("codex", "fixture-thread")).toHaveLength(6);
			expect(db.ingestState.listWarnings().some((w) => w.code === "cursor-reset")).toBe(true);
			const current = db.ingestState.getCursor("codex", f.codex, file);
			expect(current?.metadata?.senseiReaderVersion).toBe("codex/transcript/4");
			await runSenseiIngestScanCommand(f.config);
			expect(db.ingestState.getCursor("codex", f.codex, file)).toEqual(current);
			expect(db.evidence.list("codex", "fixture-thread")).toHaveLength(6);
		} finally {
			db.close();
		}
	} finally {
		f.cleanup();
	}
});
