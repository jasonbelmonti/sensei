import { afterEach, expect, test } from "bun:test";

import {
	deriveWorkflowSearchRows,
	extractTurnFeatures,
	CURRENT_TURN_FEATURE_VERSION,
} from "../../src/analysis";
import type { SenseiStorage, StoreWorkflowSearchDocumentInput } from "../../src/storage";
import { seedAnalyzeFixture } from "./analyze-fixture";
import { createStorageTestHarness } from "./helpers";

const cleanups: Array<() => void> = [];

type SearchDocumentFixtureInput = {
	sessionId: string;
	turnId: string;
	featureVersion: number;
	promptText: string;
	tags: readonly string[];
	workflowIntentLabels: readonly string[];
	searchText: string;
	updatedAt: string;
};

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

test("workflow search queries match tag and workflow intent label terms through FTS", () => {
	const harness = createStorageTestHarness("sensei-workflow-search-fts-columns");
	cleanups.push(harness.cleanup);

	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-tag",
		turnId: "turn-tag",
		featureVersion: 1,
		promptText: "Document the storage foundation.",
		tags: ["stable"],
		workflowIntentLabels: ["explain"],
		searchText: "Document the storage foundation.",
		updatedAt: "2026-04-21T13:00:00.000Z",
	});
	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-label",
		turnId: "turn-label",
		featureVersion: 1,
		promptText: "Compare workflow storage options.",
		tags: ["comparison"],
		workflowIntentLabels: ["research"],
		searchText: "Compare workflow storage options.",
		updatedAt: "2026-04-21T13:01:00.000Z",
	});

	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "stable",
		}),
	).toEqual([
		expect.objectContaining({
			sessionId: "session-tag",
			turnId: "turn-tag",
		}),
	]);
	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "research",
		}),
	).toEqual([
		expect.objectContaining({
			sessionId: "session-label",
			turnId: "turn-label",
		}),
	]);
});

test("workflow search queries stay scoped to the requested feature version", () => {
	const harness = createStorageTestHarness(
		"sensei-workflow-search-feature-version-scope",
	);
	cleanups.push(harness.cleanup);

	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-version-1",
		turnId: "turn-version-1",
		featureVersion: 1,
		promptText: "Explain workflow retrieval behavior.",
		tags: ["shared-term"],
		workflowIntentLabels: ["explain"],
		searchText: "Explain workflow retrieval behavior shared-term",
		updatedAt: "2026-04-21T13:10:00.000Z",
	});
	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-version-2",
		turnId: "turn-version-2",
		featureVersion: 2,
		promptText: "Explain workflow retrieval behavior.",
		tags: ["shared-term"],
		workflowIntentLabels: ["explain"],
		searchText: "Explain workflow retrieval behavior shared-term",
		updatedAt: "2026-04-21T13:11:00.000Z",
	});

	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "shared-term",
		}),
	).toEqual([
		expect.objectContaining({
			featureVersion: 1,
			sessionId: "session-version-1",
		}),
	]);
	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 2,
			queryText: "shared-term",
		}),
	).toEqual([
		expect.objectContaining({
			featureVersion: 2,
			sessionId: "session-version-2",
		}),
	]);
});

test("workflow search queries return stable ordering and honor result limits", () => {
	const harness = createStorageTestHarness(
		"sensei-workflow-search-stable-ordering",
	);
	cleanups.push(harness.cleanup);

	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-a",
		turnId: "turn-a",
		featureVersion: 1,
		promptText: "Workflow storage baseline.",
		tags: ["ordering"],
		workflowIntentLabels: ["explain"],
		searchText: "Workflow storage baseline ordering",
		updatedAt: "2026-04-21T13:20:00.000Z",
	});
	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-b",
		turnId: "turn-b",
		featureVersion: 1,
		promptText: "Workflow storage baseline.",
		tags: ["ordering"],
		workflowIntentLabels: ["explain"],
		searchText: "Workflow storage baseline ordering",
		updatedAt: "2026-04-21T13:21:00.000Z",
	});

	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "ordering",
		}),
	).toEqual([
		expect.objectContaining({
			sessionId: "session-a",
			turnId: "turn-a",
		}),
		expect.objectContaining({
			sessionId: "session-b",
			turnId: "turn-b",
		}),
	]);
	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "ordering",
			limit: 1,
		}),
	).toEqual([
		expect.objectContaining({
			sessionId: "session-a",
			turnId: "turn-a",
		}),
	]);
});

test("workflow search queries return no rows for blank or unmatched input", () => {
	const harness = createStorageTestHarness("sensei-workflow-search-no-results");
	cleanups.push(harness.cleanup);

	seedSearchDocumentFixture(harness.storage, {
		sessionId: "session-empty",
		turnId: "turn-empty",
		featureVersion: 1,
		promptText: "Explain workflow storage.",
		tags: ["storage"],
		workflowIntentLabels: ["explain"],
		searchText: "Explain workflow storage.",
		updatedAt: "2026-04-21T13:30:00.000Z",
	});

	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "   ",
		}),
	).toEqual([]);
	expect(
		harness.storage.workflowSearch.search({
			featureVersion: 1,
			queryText: "nonexistent",
		}),
	).toEqual([]);
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

function seedSearchDocumentFixture(
	storage: Pick<SenseiStorage, "conversations" | "turnFeatures" | "workflowSearch">,
	input: SearchDocumentFixtureInput,
): void {
	const threadName = `Thread ${input.sessionId}`;

	storage.conversations.upsertSession({
		provider: "codex",
		sessionId: input.sessionId,
		identityState: "canonical",
		workingDirectory: "/repo/sensei",
		metadata: {
			threadName,
			tags: [...input.tags],
		},
		source: {
			provider: "codex",
			kind: "snapshot",
			discoveryPhase: "initial_scan",
			rootPath: "/Users/test/.codex",
			filePath: `/Users/test/.codex/${input.sessionId}.json`,
		},
		completeness: "complete",
		observationReason: "snapshot",
		observedAt: input.updatedAt,
	});
	storage.conversations.upsertTurn({
		provider: "codex",
		sessionId: input.sessionId,
		turnId: input.turnId,
		status: "completed",
		input: {
			prompt: input.promptText,
		},
		output: {
			text: "Fixture output.",
		},
		startedAt: input.updatedAt,
		completedAt: input.updatedAt,
	});
	storage.turnFeatures.upsert({
		provider: "codex",
		sessionId: input.sessionId,
		turnId: input.turnId,
		featureVersion: input.featureVersion,
		analyzedAt: input.updatedAt,
		turnSequence: 1,
		turnStatus: "completed",
		promptCharacterCount: input.promptText.length,
		attachmentCount: 0,
		toolCallCount: 0,
		hasStructuredOutput: false,
		hasError: false,
		detail: {
			fixture: true,
		},
		evidence: {
			fixture: true,
		},
	});
	storage.workflowSearch.upsert(
		createSearchDocumentInput(input, threadName),
	);
}

function createSearchDocumentInput(
	input: SearchDocumentFixtureInput,
	threadName: string,
): StoreWorkflowSearchDocumentInput {
	return {
		provider: "codex",
		sessionId: input.sessionId,
		turnId: input.turnId,
		featureVersion: input.featureVersion,
		promptText: input.promptText,
		normalizedPromptText: input.promptText.toLowerCase(),
		threadName,
		projectPath: "/repo/sensei",
		tags: input.tags,
		workflowIntentLabels: input.workflowIntentLabels,
		searchText: input.searchText,
		updatedAt: input.updatedAt,
	};
}
