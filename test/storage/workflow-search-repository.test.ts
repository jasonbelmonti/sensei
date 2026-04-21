import { afterEach, expect, test } from "bun:test";

import {
	deriveWorkflowSearchRows,
	extractTurnFeatures,
	CURRENT_TURN_FEATURE_VERSION,
} from "../../src/analysis";
import type { SenseiStorage } from "../../src/storage";
import { seedAnalyzeFixture } from "./analyze-fixture";
import { createStorageTestHarness } from "./helpers";

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length > 0) {
		cleanups.pop()?.();
	}
});

test("workflow search replacement drops stale current-version rows on rerun", () => {
	const harness = createStorageTestHarness(
		"sensei-workflow-search-current-version-refresh",
	);
	cleanups.push(harness.cleanup);
	const fixture = seedAnalyzeFixture(harness.storage);

	const firstRun = persistDerivedWorkflowSearchRows(harness.storage, {
		analyzedAt: "2026-04-19T02:00:00.000Z",
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

	const rerun = persistDerivedWorkflowSearchRows(harness.storage, {
		analyzedAt: "2026-04-19T03:00:00.000Z",
	});

	expect(firstRun.persistedSearchRows).toHaveLength(3);
	expect(rerun.extraction.summary).toEqual({
		totalTurns: 5,
		eligibleTurns: 2,
		skippedTurns: 3,
	});
	expect(rerun.persistedSearchRows).toHaveLength(2);
	expect(
		harness.storage.workflowSearch.listAll().map((row) => ({
			featureVersion: row.featureVersion,
			turnId: row.turnId,
			updatedAt: row.updatedAt,
		})),
	).toEqual([
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			turnId: "turn-001",
			updatedAt: "2026-04-19T03:00:00.000Z",
		},
		{
			featureVersion: CURRENT_TURN_FEATURE_VERSION,
			turnId: "turn-002",
			updatedAt: "2026-04-19T03:00:00.000Z",
		},
	]);
});

test("workflow search replacement preserves prior rows when the feature version changes", () => {
	const harness = createStorageTestHarness(
		"sensei-workflow-search-version-bump",
	);
	cleanups.push(harness.cleanup);
	seedAnalyzeFixture(harness.storage);

	const firstRun = persistDerivedWorkflowSearchRows(harness.storage, {
		analyzedAt: "2026-04-19T02:00:00.000Z",
	});
	const bumpedVersionRun = persistDerivedWorkflowSearchRows(harness.storage, {
		featureVersion: CURRENT_TURN_FEATURE_VERSION + 1,
		analyzedAt: "2026-04-19T04:00:00.000Z",
	});

	expect(firstRun.persistedSearchRows).toHaveLength(3);
	expect(bumpedVersionRun.persistedSearchRows).toHaveLength(3);
	expect(
		harness.storage.workflowSearch.listAll().map((row) => ({
			featureVersion: row.featureVersion,
			turnId: row.turnId,
			updatedAt: row.updatedAt,
		})),
	).toEqual([
		{
			featureVersion: 1,
			turnId: "turn-001",
			updatedAt: "2026-04-19T02:00:00.000Z",
		},
		{
			featureVersion: 1,
			turnId: "turn-002",
			updatedAt: "2026-04-19T02:00:00.000Z",
		},
		{
			featureVersion: 1,
			turnId: "turn-003",
			updatedAt: "2026-04-19T02:00:00.000Z",
		},
		{
			featureVersion: 2,
			turnId: "turn-001",
			updatedAt: "2026-04-19T04:00:00.000Z",
		},
		{
			featureVersion: 2,
			turnId: "turn-002",
			updatedAt: "2026-04-19T04:00:00.000Z",
		},
		{
			featureVersion: 2,
			turnId: "turn-003",
			updatedAt: "2026-04-19T04:00:00.000Z",
		},
	]);
});

function persistDerivedWorkflowSearchRows(
	storage: Pick<
		SenseiStorage,
		"analysisTurns" | "transaction" | "turnFeatures" | "workflowSearch"
	>,
	options: {
		analyzedAt: string;
		featureVersion?: number;
	},
) {
	const orderedTurns = storage.analysisTurns.listOrderedTurns();
	const extraction = extractTurnFeatures(orderedTurns, {
		analyzedAt: options.analyzedAt,
		featureVersion: options.featureVersion,
	});
	const derivedRows = deriveWorkflowSearchRows(orderedTurns, extraction.rows);
	const persistedSearchRows = storage.transaction(
		({ turnFeatures, workflowSearch }) => {
			turnFeatures.replaceFeatureVersion(
				extraction.featureVersion,
				extraction.rows,
			);

			return workflowSearch.replaceFeatureVersion(
				extraction.featureVersion,
				derivedRows,
			);
		},
	);

	return {
		extraction,
		derivedRows,
		persistedSearchRows,
	};
}
