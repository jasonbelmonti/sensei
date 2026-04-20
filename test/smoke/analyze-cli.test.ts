import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { openSenseiStorage } from "../../src/storage";
import { seedAnalyzeFixture } from "../storage/analyze-fixture";
import { runPackageCliCommand } from "./helpers";

test("package-level CLI script runs analyze end to end without duplicate current-version rows on rerun", () => {
	const fixtureRoot = mkdtempSync(resolve(tmpdir(), "sensei-cli-analyze-"));

	try {
		const senseiHome = resolve(fixtureRoot, ".sensei-home");
		const databasePath = resolve(senseiHome, "data", "sensei.sqlite");
		const seededStorage = openSenseiStorage({
			databasePath,
		});

		try {
			seedAnalyzeFixture(seededStorage);
		} finally {
			seededStorage.close();
		}

		const env = {
			SENSEI_HOME: senseiHome,
		};

		const firstRun = runPackageCliCommand(["analyze"], { env });
		const secondRun = runPackageCliCommand(["analyze"], { env });

		expect(firstRun.status).toBe(0);
		expect(firstRun.stderr).not.toContain('error: script "sensei" exited');
		expect(firstRun.stdout).toContain("sensei analyze completed.");
		expect(firstRun.stdout).toContain("Feature version: 1");
		expect(firstRun.stdout).toContain("Turns loaded: 5");
		expect(firstRun.stdout).toContain("Eligible turns: 3");
		expect(firstRun.stdout).toContain("Skipped turns: 2");
		expect(firstRun.stdout).toContain("Turn features persisted: 3");

		expect(secondRun.status).toBe(0);
		expect(secondRun.stderr).not.toContain('error: script "sensei" exited');

		const storage = openSenseiStorage({
			databasePath,
		});

		try {
			expect(countRows(storage, "turn_features")).toBe(3);
			expect(storage.turnFeatures.listAll()).toMatchObject([
				{
					featureVersion: 1,
					turnId: "turn-001",
				},
				{
					featureVersion: 1,
					turnId: "turn-002",
				},
				{
					featureVersion: 1,
					turnId: "turn-003",
				},
			]);
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
