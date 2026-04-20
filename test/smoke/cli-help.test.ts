import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
	createSenseiCliApplication,
	senseiCommandGroups,
} from "../../src/cli/index";
import { openSenseiStorage } from "../../src/storage";
import { runPackageCliCommand } from "./helpers";

test("cli help renders the registered command groups with injected config", async () => {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const app = createSenseiCliApplication({
		repoRoot: "/repo/sensei",
		homeDir: "/Users/sensei",
		env: {
			SENSEI_HOME: ".sensei-dev",
		},
		stdout: (line) => stdout.push(line),
		stderr: (line) => stderr.push(line),
	});

	const exitCode = await app.run(["--help"]);

	expect(exitCode).toBe(0);
	expect(stderr).toEqual([]);
	expect(app.context.config.paths.homeRoot).toBe("/Users/sensei/.sensei-dev");
	expect(stdout.join("\n")).toContain("sensei CLI");
	expect(stdout.join("\n")).toContain("Registered command groups:");

	for (const command of senseiCommandGroups) {
		expect(stdout.join("\n")).toContain(command.name);
		expect(stdout.join("\n")).toContain(command.summary);
	}
});

test("cli rejects unknown commands with a useful error", async () => {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const app = createSenseiCliApplication({
		repoRoot: "/repo/sensei",
		stdout: (line) => stdout.push(line),
		stderr: (line) => stderr.push(line),
	});

	const exitCode = await app.run(["mystery"]);

	expect(exitCode).toBe(1);
	expect(stdout).toEqual([]);
	expect(stderr).toEqual([
		"Unknown command 'mystery'.",
		"Run 'sensei --help' to inspect the registered command groups.",
	]);
});

test("registered command groups dispatch through the command shell modules", async () => {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const app = createSenseiCliApplication({
		repoRoot: "/repo/sensei",
		stdout: (line) => stdout.push(line),
		stderr: (line) => stderr.push(line),
	});

	const exitCode = await app.run(["ingest"]);

	expect(exitCode).toBe(1);
	expect(stdout).toEqual([]);
	expect(stderr).toEqual([
		"Missing ingest subcommand.",
		"Usage: sensei ingest <scan|watch>",
		"Run 'sensei ingest --help' to inspect the available subcommands.",
	]);
});

test("package-level CLI script renders help from the repo root", () => {
	const result = runPackageCliCommand(["--help"]);

	expect(result.status).toBe(0);
	expect(result.stderr).not.toContain('error: script "sensei" exited');
	expect(result.stdout).toContain("sensei CLI");
	expect(result.stdout).toContain("Registered command groups:");

	for (const command of senseiCommandGroups) {
		expect(result.stdout).toContain(command.name);
		expect(result.stdout).toContain(command.summary);
	}
});

test("package-level CLI script runs ingest scan from the repo root without duplicate canonical rows on rerun", () => {
	const fixtureRoot = mkdtempSync(resolve(tmpdir(), "sensei-cli-ingest-"));

	try {
		const senseiHome = resolve(fixtureRoot, ".sensei-home");
		const claudeRoot = resolve(fixtureRoot, ".claude");
		const codexRoot = resolve(fixtureRoot, ".codex");
		const sessionIndexPath = resolve(codexRoot, "session-index.jsonl");

		mkdirSync(claudeRoot, { recursive: true });
		mkdirSync(codexRoot, { recursive: true });
		writeFileSync(
			sessionIndexPath,
			`${JSON.stringify({
				id: "session-1",
				thread_name: "BEL-718 fixture session",
				updated_at: "2026-04-11T12:00:00.000Z",
			})}\n`,
		);

		const env = {
			SENSEI_HOME: senseiHome,
			SENSEI_CLAUDE_ROOT: claudeRoot,
			SENSEI_CODEX_ROOT: codexRoot,
		};

		const firstRun = runPackageCliCommand(["ingest", "scan"], { env });
		const secondRun = runPackageCliCommand(["ingest", "scan"], { env });

		expect(firstRun.status).toBe(0);
		expect(firstRun.stderr).not.toContain('error: script "sensei" exited');
		expect(firstRun.stdout).toContain("sensei ingest scan completed.");
		expect(firstRun.stdout).toContain("Roots scanned: 2");
		expect(firstRun.stdout).toContain("Processed records: 1");
		expect(firstRun.stdout).toContain("Sessions written: 1");
		expect(firstRun.stdout).toContain("Cursors written: 1");
		expect(firstRun.stdout).toContain("Warnings recorded: 0");

		expect(secondRun.status).toBe(0);
		expect(secondRun.stderr).not.toContain('error: script "sensei" exited');

		const storage = openSenseiStorage({
			databasePath: resolve(senseiHome, "data", "sensei.sqlite"),
		});

		try {
			expect(countRows(storage, "sessions")).toBe(1);
			expect(countRows(storage, "ingest_cursors")).toBe(1);
			expect(
				storage.conversations.getSession("codex", "session-1"),
			).toMatchObject({
				provider: "codex",
				sessionId: "session-1",
				metadata: {
					threadName: "BEL-718 fixture session",
				},
			});
		} finally {
			storage.close();
		}
	} finally {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}
});

function countRows(
	storage: ReturnType<typeof openSenseiStorage>,
	table: string,
): number {
	const row = storage.database
		.query(`SELECT COUNT(*) as count FROM ${table}`)
		.get() as { count: number };

	return row.count;
}
