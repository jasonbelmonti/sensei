import type {
	ReplaceWorkflowFamiliesInput,
	SenseiStorage,
	StoreWorkflowSearchDocumentInput,
} from "../../src/storage";

const WORKFLOW_STORAGE_PROVIDER = "codex";
const WORKFLOW_STORAGE_SESSION_ID = "workflow-session";
const WORKFLOW_STORAGE_TURN_ID = "turn-001";

type WorkflowSearchDocumentFixture = {
	promptText: string;
	normalizedPromptText: string;
	tags: string[];
	exactFingerprint: string;
	nearFingerprint: string;
	searchText: string;
	updatedAt: string;
};

type WorkflowFamilyFixture = {
	familyId: string;
	reason: string;
	match: string;
	updatedAt: string;
	memberUpdatedAt: string;
};

const WORKFLOW_SEARCH_DOCUMENT_FIXTURES: Record<
	number,
	WorkflowSearchDocumentFixture
> = {
	1: {
		promptText: "Explain the stable BEL-805 workflow storage foundation.",
		normalizedPromptText: "explain stable bel 805 workflow storage foundation",
		tags: ["storage", "bel-805", "stable"],
		exactFingerprint: "exact-v1-stable",
		nearFingerprint: "near-v1-stable",
		searchText:
			"Explain the stable BEL-805 workflow storage foundation BEL-805 storage /repo/sensei storage bel-805 stable",
		updatedAt: "2026-04-20T21:22:00.000Z",
	},
	2: {
		promptText: "Explain the refreshed BEL-805 workflow storage foundation.",
		normalizedPromptText:
			"explain refreshed bel 805 workflow storage foundation",
		tags: ["storage", "bel-805", "refresh"],
		exactFingerprint: "exact-v2",
		nearFingerprint: "near-v2",
		searchText:
			"Explain the refreshed BEL-805 workflow storage foundation BEL-805 storage /repo/sensei storage bel-805 refresh",
		updatedAt: "2026-04-20T21:21:00.000Z",
	},
} as const;

const WORKFLOW_FAMILY_FIXTURES: Record<number, WorkflowFamilyFixture> = {
	1: {
		familyId: "family-stable",
		reason: "stable prompt family rerun",
		match: "exact-rerun",
		updatedAt: "2026-04-20T21:25:00.000Z",
		memberUpdatedAt: "2026-04-20T21:25:30.000Z",
	},
	2: {
		familyId: "family-refreshed",
		reason: "refreshed prompt family",
		match: "near",
		updatedAt: "2026-04-20T21:24:00.000Z",
		memberUpdatedAt: "2026-04-20T21:24:30.000Z",
	},
} as const;

export function seedWorkflowStorageFixture(
	storage: Pick<SenseiStorage, "conversations" | "turnFeatures">,
): void {
	storage.conversations.upsertSession({
		provider: WORKFLOW_STORAGE_PROVIDER,
		sessionId: WORKFLOW_STORAGE_SESSION_ID,
		identityState: "canonical",
		workingDirectory: "/repo/sensei",
		metadata: {
			threadName: "BEL-805 storage",
			tags: ["storage", "bel-805"],
		},
		source: {
			provider: "codex",
			kind: "snapshot",
			discoveryPhase: "initial_scan",
			rootPath: "/Users/test/.codex",
			filePath: "/Users/test/.codex/workflow-session.json",
		},
		completeness: "complete",
		observationReason: "snapshot",
		observedAt: "2026-04-20T21:10:00.000Z",
	});
	storage.conversations.upsertTurn({
		provider: WORKFLOW_STORAGE_PROVIDER,
		sessionId: WORKFLOW_STORAGE_SESSION_ID,
		turnId: WORKFLOW_STORAGE_TURN_ID,
		status: "completed",
		input: {
			prompt: "Explain the BEL-805 workflow storage foundation.",
		},
		output: {
			text: "The storage foundation is ready.",
		},
		startedAt: "2026-04-20T21:11:00.000Z",
		completedAt: "2026-04-20T21:11:30.000Z",
	});

	for (const featureVersion of [1, 2] as const) {
		storage.turnFeatures.upsert({
			provider: WORKFLOW_STORAGE_PROVIDER,
			sessionId: WORKFLOW_STORAGE_SESSION_ID,
			turnId: WORKFLOW_STORAGE_TURN_ID,
			featureVersion,
			analyzedAt:
				featureVersion === 1
					? "2026-04-20T21:12:00.000Z"
					: "2026-04-20T21:13:00.000Z",
			turnSequence: 1,
			turnStatus: "completed",
			promptCharacterCount: featureVersion === 1 ? 43 : 53,
			attachmentCount: 0,
			toolCallCount: 0,
			hasStructuredOutput: false,
			hasError: false,
			detail: {
				version: featureVersion,
			},
			evidence: {
				source: "fixture",
			},
		});
	}
}

export function createWorkflowSearchDocumentInput(
	featureVersion: 1 | 2,
): StoreWorkflowSearchDocumentInput {
	const fixture = WORKFLOW_SEARCH_DOCUMENT_FIXTURES[featureVersion];

	return {
		provider: WORKFLOW_STORAGE_PROVIDER,
		sessionId: WORKFLOW_STORAGE_SESSION_ID,
		turnId: WORKFLOW_STORAGE_TURN_ID,
		featureVersion,
		promptText: fixture.promptText,
		normalizedPromptText: fixture.normalizedPromptText,
		threadName: "BEL-805 storage",
		projectPath: "/repo/sensei",
		tags: fixture.tags,
		workflowIntentLabels: ["explain", "storage-foundation"],
		exactFingerprint: fixture.exactFingerprint,
		nearFingerprint: fixture.nearFingerprint,
		searchText: fixture.searchText,
		updatedAt: fixture.updatedAt,
	};
}

export function createWorkflowFamiliesInput(
	featureVersion: 1 | 2,
): ReplaceWorkflowFamiliesInput {
	const fixture = WORKFLOW_FAMILY_FIXTURES[featureVersion];

	return {
		families: [
			{
				featureVersion,
				familyId: fixture.familyId,
				providerBreakdown: {
					codex: 1,
				},
				evidence: {
					reason: fixture.reason,
				},
				updatedAt: fixture.updatedAt,
			},
		],
		members: [
			{
				featureVersion,
				familyId: fixture.familyId,
				provider: WORKFLOW_STORAGE_PROVIDER,
				sessionId: WORKFLOW_STORAGE_SESSION_ID,
				turnId: WORKFLOW_STORAGE_TURN_ID,
				evidence: {
					match: fixture.match,
				},
				updatedAt: fixture.memberUpdatedAt,
			},
		],
	};
}
