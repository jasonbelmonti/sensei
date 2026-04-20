import type { SenseiStorage } from "../../src/storage";

const FIXTURE_PROVIDER = "codex";
const FIXTURE_ROOT_PATH = "/Users/test/.codex";
const FIXTURE_TIMESTAMP_PREFIX = "2026-04-18T19:";

export type AnalyzeFixture = {
	canonicalSessionId: string;
	eligibleTurnIds: readonly string[];
	skippedTurnIds: readonly string[];
	provisionalTurnId: string;
};

export function seedAnalyzeFixture(
	storage: Pick<SenseiStorage, "conversations">,
): AnalyzeFixture {
	const canonicalSessionId = "analysis-session";
	const provisionalSessionId = "analysis-session-provisional";
	const eligibleTurnIds = ["turn-001", "turn-002", "turn-003"] as const;
	const skippedTurnIds = ["turn-004", "turn-005"] as const;
	const provisionalTurnId = "turn-provisional-001";

	storage.conversations.upsertSession({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		identityState: "canonical",
		source: createSessionSource(
			canonicalSessionId,
			"initial_scan",
			"session-index",
			"/Users/test/.codex/session-index.jsonl",
		),
		completeness: "complete",
		observationReason: "index",
		observedAt: createFixtureTimestamp(0),
	});
	storage.conversations.upsertSession({
		provider: FIXTURE_PROVIDER,
		sessionId: provisionalSessionId,
		identityState: "provisional",
		source: createSessionSource(
			provisionalSessionId,
			"watch",
			"transcript",
			"/Users/test/.codex/transcripts/analysis-session-provisional.jsonl",
		),
		completeness: "partial",
		observationReason: "transcript",
		observedAt: createFixtureTimestamp(0, 30),
	});

	storage.conversations.upsertTurn({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[0],
		status: "completed",
		input: {
			prompt: "Explain the baseline analyzer behavior.",
		},
		output: {
			text: "Baseline analyzer behavior is stable.",
		},
		startedAt: createFixtureTimestamp(1),
		completedAt: createFixtureTimestamp(1, 5),
	});
	storage.conversations.upsertTurnUsage({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[0],
		inputTokens: 120,
		outputTokens: 80,
		cachedInputTokens: 20,
		costUsd: 0.012,
	});
	storage.conversations.upsertToolEvent({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[0],
		toolCallId: "tool-001",
		status: "completed",
		toolName: "exec_command",
		toolKind: "command",
		outcome: "success",
		completedAt: createFixtureTimestamp(1, 3),
	});

	storage.conversations.upsertTurn({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[1],
		status: "failed",
		input: {
			prompt: "Retry the analyzer after the earlier failure.",
		},
		error: {
			code: "tool_failed",
			message: "Analyzer tool execution failed.",
		},
		startedAt: createFixtureTimestamp(2),
		failedAt: createFixtureTimestamp(2, 5),
	});
	storage.conversations.upsertTurnUsage({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[1],
		inputTokens: 90,
		outputTokens: 20,
		costUsd: 0.008,
	});
	storage.conversations.upsertToolEvent({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[1],
		toolCallId: "tool-002",
		status: "completed",
		toolName: "exec_command",
		toolKind: "command",
		outcome: "error",
		errorMessage: "command failed",
		completedAt: createFixtureTimestamp(2, 4),
	});

	storage.conversations.upsertTurn({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[2],
		status: "completed",
		input: {
			prompt: "Retry the analyzer and inspect the tool failures.",
		},
		output: {
			text: "Retried analyzer output.",
			structuredOutput: {
				ok: true,
			},
		},
		startedAt: createFixtureTimestamp(3),
		completedAt: createFixtureTimestamp(3, 5),
	});
	storage.conversations.upsertTurnUsage({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[2],
		inputTokens: 110,
		outputTokens: 95,
		cachedInputTokens: 10,
		costUsd: 0.014,
	});
	storage.conversations.upsertToolEvent({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[2],
		toolCallId: "tool-003",
		status: "completed",
		toolName: "exec_command",
		toolKind: "command",
		outcome: "success",
		completedAt: createFixtureTimestamp(3, 3),
	});
	storage.conversations.upsertToolEvent({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: eligibleTurnIds[2],
		toolCallId: "tool-004",
		status: "completed",
		toolName: "exec_command",
		toolKind: "command",
		outcome: "success",
		completedAt: createFixtureTimestamp(3, 4),
	});

	storage.conversations.upsertTurn({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: skippedTurnIds[0],
		status: "completed",
		input: {
			prompt: "   ",
		},
		output: {
			text: "Blank input should be skipped.",
		},
		startedAt: createFixtureTimestamp(4),
		completedAt: createFixtureTimestamp(4, 5),
	});
	storage.conversations.upsertTurn({
		provider: FIXTURE_PROVIDER,
		sessionId: canonicalSessionId,
		turnId: skippedTurnIds[1],
		status: "completed",
		output: {
			text: "Missing prompt input should be skipped.",
		},
		startedAt: createFixtureTimestamp(5),
		completedAt: createFixtureTimestamp(5, 5),
	});

	storage.conversations.upsertTurn({
		provider: FIXTURE_PROVIDER,
		sessionId: provisionalSessionId,
		turnId: provisionalTurnId,
		status: "completed",
		input: {
			prompt: "This provisional turn should stay out of analysis.",
		},
		output: {
			text: "Provisional sessions are not canonical yet.",
		},
		startedAt: createFixtureTimestamp(6),
		completedAt: createFixtureTimestamp(6, 5),
	});

	return {
		canonicalSessionId,
		eligibleTurnIds,
		skippedTurnIds,
		provisionalTurnId,
	};
}

function createSessionSource(
	sessionId: string,
	discoveryPhase: "initial_scan" | "watch",
	kind: "session-index" | "transcript",
	filePath: string,
) {
	return {
		provider: FIXTURE_PROVIDER as const,
		kind,
		discoveryPhase,
		rootPath: FIXTURE_ROOT_PATH,
		filePath,
		metadata: {
			sessionId,
		},
	};
}

function createFixtureTimestamp(minute: number, second = 0): string {
	return `${FIXTURE_TIMESTAMP_PREFIX}${String(minute).padStart(2, "0")}:${String(
		second,
	).padStart(2, "0")}.000Z`;
}
