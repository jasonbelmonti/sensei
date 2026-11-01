import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	readFileSync,
	copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSenseiConfig } from "../../src/config/index.js";
import { openSenseiStorage } from "../../src/storage/database.js";
export const fixtureRoot = fileURLToPath(
	new URL("../fixtures/current-ingest/", import.meta.url),
);
export const expected = JSON.parse(
	readFileSync(join(fixtureRoot, "expected.json"), "utf8"),
);
export function currentFixture(copy = true) {
	const root = mkdtempSync(join(tmpdir(), "sensei-current-"));
	const codex = join(root, "codex");
	const copilot = join(root, "copilot");
	const claude = join(root, "claude");
	for (const path of [codex, copilot, claude]) mkdirSync(path);
	if (copy) {
		copyFileSync(
			join(fixtureRoot, "codex.jsonl"),
			join(codex, "session.jsonl"),
		);
		copyFileSync(
			join(fixtureRoot, "copilot.jsonl"),
			join(copilot, "events.jsonl"),
		);
	}
	const config = createSenseiConfig({
		repoRoot: root,
		homeDir: root,
		env: {
			SENSEI_HOME: join(root, "home"),
			SENSEI_CODEX_ROOT: codex,
			SENSEI_COPILOT_ROOT: copilot,
			SENSEI_CLAUDE_ROOT: claude,
		},
	});
	return {
		root,
		codex,
		copilot,
		config,
		open: () => openSenseiStorage({ databasePath: config.paths.databasePath }),
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
}
