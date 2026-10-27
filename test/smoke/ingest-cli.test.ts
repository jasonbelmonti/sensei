import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { openSenseiStorage } from "../../src/storage/index.js";
import { runPackageCliCommand, smokeTestRootDir } from "./helpers.js";

test("compiled CLI preserves Claude sessions and legacy Codex turns through Claudex on replay", () => {
	const root = mkdtempSync(join(tmpdir(), "sensei-ingest-cli-"));
	try {
		const env = {
			SENSEI_HOME: join(root, "sensei"),
			SENSEI_CLAUDE_ROOT: join(root, "claude"),
			SENSEI_CODEX_ROOT: join(root, "codex"),
		};
		for (const provider of ["claude", "codex"]) {
			mkdirSync(join(root, provider));
			copyFileSync(
				join(
					smokeTestRootDir,
					"test/fixtures/legacy-ingest",
					`${provider}.jsonl`,
				),
				join(root, provider, "session.jsonl"),
			);
		}
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const result = runPackageCliCommand(["ingest", "scan"], {
				env,
				cwd: root,
			});
			expect(result.status, result.stderr).toBe(0);
			expect(result.stderr).toBe("");
			expect(result.stdout).toContain("sensei ingest scan completed.");
			const storage = openSenseiStorage({
				databasePath: join(env.SENSEI_HOME, "data/sensei.sqlite"),
				readonly: true,
			});
			try {
				// The legacy Claude normalizer has no turn IDs; session persistence is
				// its existing contract here. Full turn ingestion belongs to its replacement.
				expect(
					storage.conversations.getSession("claude", "claude-node-smoke"),
				).toMatchObject({
					identityState: "canonical",
					workingDirectory: "/fixture/project",
				});
				expect(
					storage.database
						.query(`
					SELECT provider, status, input_prompt AS prompt, output_text AS output
					FROM turns WHERE provider = 'codex' ORDER BY turn_id
				`)
						.all(),
				).toEqual([
					{
						provider: "codex",
						status: "completed",
						prompt: "Review the Codex fixture.",
						output: "Codex fixture reviewed.",
					},
				]);
				expect(
					storage.database
						.query("SELECT count(*) AS count FROM sessions")
						.get(),
				).toEqual({ count: 2 });
				expect(
					storage.database
						.query("SELECT count(*) AS count FROM ingest_cursors")
						.get(),
				).toEqual({ count: 2 });
				expect(storage.ingestState.listWarnings()).toEqual([]);
			} finally {
				storage.close();
			}
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
