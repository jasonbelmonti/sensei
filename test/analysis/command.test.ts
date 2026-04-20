import { afterEach, expect, test } from "bun:test";
import { dirname, join } from "node:path";

import {
	CURRENT_TURN_FEATURE_VERSION,
	runSenseiAnalyzeCommand,
} from "../../src/analysis";
import type { SenseiRuntimeConfig } from "../../src/config";
import { seedAnalyzeFixture } from "../storage/analyze-fixture";
import { createStorageTestHarness } from "../storage/helpers";

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length > 0) {
		cleanups.pop()?.();
	}
});

test("analyze command reruns in place for the current feature version without duplicating rows", async () => {
	const harness = createStorageTestHarness("sensei-analyze-current-version");
	cleanups.push(harness.cleanup);
	seedAnalyzeFixture(harness.storage);
	const config = createAnalyzeConfig(harness.databasePath);

	const firstRun = await runSenseiAnalyzeCommand(config, {
		now: () => "2026-04-19T02:00:00.000Z",
	});
	const secondRun = await runSenseiAnalyzeCommand(config, {
		now: () => "2026-04-19T03:00:00.000Z",
	});

	expect(firstRun).toMatchObject({
		featureVersion: CURRENT_TURN_FEATURE_VERSION,
		analyzedAt: "2026-04-19T02:00:00.000Z",
		totalTurns: 5,
		eligibleTurns: 3,
		skippedTurns: 2,
		persistedRows: 3,
		skippedByReason: {
			"blank-prompt-input": 1,
			"missing-prompt-input": 1,
		},
	});
	expect(secondRun).toMatchObject({
		featureVersion: CURRENT_TURN_FEATURE_VERSION,
		analyzedAt: "2026-04-19T03:00:00.000Z",
		persistedRows: 3,
	});
	expect(harness.storage.turnFeatures.listAll()).toMatchObject([
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			analyzedAt: "2026-04-19T03:00:00.000Z",
			turnId: "turn-001",
		},
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			analyzedAt: "2026-04-19T03:00:00.000Z",
			turnId: "turn-002",
		},
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			analyzedAt: "2026-04-19T03:00:00.000Z",
			turnId: "turn-003",
		},
	]);
});

test("analyze command removes stale current-version rows when turns become ineligible", async () => {
	const harness = createStorageTestHarness("sensei-analyze-stale-rows");
	cleanups.push(harness.cleanup);
	const fixture = seedAnalyzeFixture(harness.storage);
	const config = createAnalyzeConfig(harness.databasePath);

	await runSenseiAnalyzeCommand(config, {
		now: () => "2026-04-19T02:00:00.000Z",
	});

	harness.storage.conversations.upsertTurn({
		provider: "codex",
		sessionId: fixture.canonicalSessionId,
		turnId: fixture.eligibleTurnIds[2],
		status: "completed",
		input: {
			prompt: "   ",
		},
		output: {
			text: "This turn should now be skipped.",
		},
		startedAt: "2026-04-18T19:03:00.000Z",
		completedAt: "2026-04-18T19:03:05.000Z",
	});

	const rerun = await runSenseiAnalyzeCommand(config, {
		now: () => "2026-04-19T03:00:00.000Z",
	});

	expect(rerun).toMatchObject({
		featureVersion: CURRENT_TURN_FEATURE_VERSION,
		analyzedAt: "2026-04-19T03:00:00.000Z",
		totalTurns: 5,
		eligibleTurns: 2,
		skippedTurns: 3,
		persistedRows: 2,
		skippedByReason: {
			"blank-prompt-input": 2,
			"missing-prompt-input": 1,
		},
	});
	expect(
		harness.storage.turnFeatures.listAll().map((row) => ({
			featureVersion: row.featureVersion,
			analyzedAt: row.analyzedAt,
			turnId: row.turnId,
		})),
	).toEqual([
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			analyzedAt: "2026-04-19T03:00:00.000Z",
			turnId: "turn-001",
		},
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			analyzedAt: "2026-04-19T03:00:00.000Z",
			turnId: "turn-002",
		},
	]);
});

test("analyze command writes parallel rows when the feature version changes", async () => {
	const harness = createStorageTestHarness("sensei-analyze-version-bump");
	cleanups.push(harness.cleanup);
	seedAnalyzeFixture(harness.storage);
	const config = createAnalyzeConfig(harness.databasePath);

	await runSenseiAnalyzeCommand(config, {
		now: () => "2026-04-19T02:00:00.000Z",
	});
	const bumpedVersionRun = await runSenseiAnalyzeCommand(config, {
		featureVersion: CURRENT_TURN_FEATURE_VERSION + 1,
		now: () => "2026-04-19T04:00:00.000Z",
	});

	expect(bumpedVersionRun).toMatchObject({
		featureVersion: CURRENT_TURN_FEATURE_VERSION + 1,
		analyzedAt: "2026-04-19T04:00:00.000Z",
		persistedRows: 3,
	});
	expect(
		harness.storage.turnFeatures.listAll().map((row) => ({
			featureVersion: row.featureVersion,
			turnId: row.turnId,
		})),
	).toEqual([
		{ featureVersion: 1, turnId: "turn-001" },
		{ featureVersion: 1, turnId: "turn-002" },
		{ featureVersion: 1, turnId: "turn-003" },
		{ featureVersion: 2, turnId: "turn-001" },
		{ featureVersion: 2, turnId: "turn-002" },
		{ featureVersion: 2, turnId: "turn-003" },
	]);
});

function createAnalyzeConfig(
	databasePath: string,
): Pick<SenseiRuntimeConfig, "paths"> {
	const dataRoot = dirname(databasePath);
	const homeRoot = dirname(dataRoot);
	const generatedRoot = "/repo/sensei/generated";

	return {
		paths: {
			repoRoot: "/repo/sensei",
			homeRoot,
			dataRoot,
			cacheRoot: join(homeRoot, "cache"),
			reportsRoot: join(homeRoot, "reports"),
			databasePath,
			providers: {
				claude: "/Users/test/.claude",
				codex: "/Users/test/.codex",
			},
			generated: {
				root: generatedRoot,
				skills: join(generatedRoot, "skills"),
				scripts: join(generatedRoot, "scripts"),
				automations: join(generatedRoot, "automations"),
			},
		},
	};
}
