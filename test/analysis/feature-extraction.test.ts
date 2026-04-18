import { expect, test } from "bun:test";

import {
  buildTurnFeatureRow,
  CURRENT_TURN_FEATURE_VERSION,
  extractTurnFeatures,
  getTurnFeatureEligibility,
  TURN_FEATURE_SCORE_RANGE,
  type WriteReadyTurnFeatureRow,
} from "../../src/analysis";
import type { OrderedAnalysisTurnInput } from "../../src/storage";

const FIXED_ANALYZED_AT = "2026-04-18T19:45:00.000Z";
const ELIGIBLE_COMPLETED_PROMPT =
  "Implement the BEL-757 feature extraction foundation.";
const ELIGIBLE_FAILED_PROMPT = "Debug why the analyzer skipped this prompt.";

test("feature extraction returns one write-ready row per eligible turn", () => {
  const extraction = extractTurnFeatures(
    [
      createOrderedTurnInput({
        turnSequence: 1,
        turnId: "turn-eligible-completed",
        prompt: ELIGIBLE_COMPLETED_PROMPT,
        attachments: [{ kind: "image", name: "diagram.png" }],
        output: {
          text: "Implemented the requested foundation.",
          structuredOutput: {
            ok: true,
          },
        },
        usage: {
          inputTokens: 120,
          outputTokens: 45,
          cachedInputTokens: 30,
          costUsd: 0.012,
        },
        toolEvents: [
          {
            toolCallId: "tool-1",
            status: "completed",
            toolName: "exec_command",
            outcome: "success",
          },
        ],
      }),
      createOrderedTurnInput({
        turnSequence: 2,
        turnId: "turn-eligible-failed",
        prompt: ELIGIBLE_FAILED_PROMPT,
        status: "failed",
        error: {
          code: "timeout",
          message: "tool call timed out",
        },
      }),
      createOrderedTurnInput({
        turnSequence: 3,
        turnId: "turn-missing-prompt",
      }),
      createOrderedTurnInput({
        turnSequence: 4,
        turnId: "turn-blank-prompt",
        prompt: "   ",
      }),
    ],
    {
      analyzedAt: FIXED_ANALYZED_AT,
    },
  );

  expect(extraction.featureVersion).toBe(CURRENT_TURN_FEATURE_VERSION);
  expect(extraction.summary).toEqual({
    totalTurns: 4,
    eligibleTurns: 2,
    skippedTurns: 2,
  });
  expect(extraction.skipped).toEqual([
    {
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-missing-prompt",
      turnSequence: 3,
      reason: "missing-prompt-input",
    },
    {
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-blank-prompt",
      turnSequence: 4,
      reason: "blank-prompt-input",
    },
  ]);
  expect(extraction.rows).toHaveLength(2);
  expect(extraction.rows[0]).toEqual<WriteReadyTurnFeatureRow>({
    provider: "codex",
    sessionId: "session-1",
    turnId: "turn-eligible-completed",
    featureVersion: CURRENT_TURN_FEATURE_VERSION,
    analyzedAt: FIXED_ANALYZED_AT,
    turnSequence: 1,
    turnStatus: "completed",
    promptCharacterCount: ELIGIBLE_COMPLETED_PROMPT.length,
    attachmentCount: 1,
    toolCallCount: 1,
    hasStructuredOutput: true,
    hasError: false,
    inputTokens: 120,
    outputTokens: 45,
    cachedInputTokens: 30,
    costUsd: 0.012,
    detail: {
      labels: [],
      scores: {
        retry: TURN_FEATURE_SCORE_RANGE.min,
        friction: TURN_FEATURE_SCORE_RANGE.min,
      },
      analyzers: {
        textStructure: {
          applied: false,
          labels: [],
          ruleIds: [],
        },
        correctionMarkers: {
          applied: false,
          labels: [],
          ruleIds: [],
        },
        workflowIntent: {
          applied: false,
          labels: [],
          ruleIds: [],
        },
        frictionSignals: {
          applied: false,
          labels: [],
          ruleIds: [],
        },
      },
    },
    evidence: {
      eligibility: {
        reasons: ["prompt-present"],
        hasPrompt: true,
        hasStructuredOutput: true,
        hasError: false,
      },
      trace: {
        ruleIds: ["rollup:base-fields"],
        priorTurnIds: [],
        toolCallIds: ["tool-1"],
      },
    },
  });
  expect(extraction.rows[1]).toMatchObject({
    turnId: "turn-eligible-failed",
    turnStatus: "failed",
    promptCharacterCount: ELIGIBLE_FAILED_PROMPT.length,
    hasStructuredOutput: false,
    hasError: true,
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    costUsd: null,
    evidence: {
      eligibility: {
        reasons: ["prompt-present"],
        hasPrompt: true,
        hasStructuredOutput: false,
        hasError: true,
      },
    },
  });
});

test("feature extraction is deterministic for the same ordered turn fixtures", () => {
  const orderedTurns = [
    createOrderedTurnInput({
      turnSequence: 10,
      turnId: "turn-stable",
      prompt: "Explain the feature extraction contract.",
      toolEvents: [
        {
          toolCallId: "tool-a",
          status: "completed",
        },
        {
          toolCallId: "tool-b",
          status: "completed",
        },
      ],
    }),
  ];

  const first = extractTurnFeatures(orderedTurns, {
    analyzedAt: FIXED_ANALYZED_AT,
  });
  const second = extractTurnFeatures(orderedTurns, {
    analyzedAt: FIXED_ANALYZED_AT,
  });

  expect(second).toEqual(first);
});

test("feature extraction exposes explicit eligibility decisions", () => {
  expect(
    getTurnFeatureEligibility(
      createOrderedTurnInput({
        turnSequence: 1,
        turnId: "turn-1",
      }),
    ),
  ).toEqual({
    eligible: false,
    reason: "missing-prompt-input",
  });
  expect(
    getTurnFeatureEligibility(
      createOrderedTurnInput({
        turnSequence: 2,
        turnId: "turn-2",
        prompt: "   ",
      }),
    ),
  ).toEqual({
    eligible: false,
    reason: "blank-prompt-input",
  });
  expect(
    getTurnFeatureEligibility(
      createOrderedTurnInput({
        turnSequence: 3,
        turnId: "turn-3",
        prompt: "Plan the next analyzer step.",
      }),
    ),
  ).toEqual({
    eligible: true,
  });
});

test("rollup derives prompt evidence from the turn payload", () => {
  const row = buildTurnFeatureRow(
    createOrderedTurnInput({
      turnSequence: 5,
      turnId: "turn-direct-rollup-no-prompt",
    }),
    {
      analyzedAt: FIXED_ANALYZED_AT,
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
    },
  );

  expect(row.promptCharacterCount).toBe(0);
  expect(row.evidence.eligibility).toEqual({
    reasons: [],
    hasPrompt: false,
    hasStructuredOutput: false,
    hasError: false,
  });
});

test("rollup guards non-finite analyzer scores before clamping", () => {
  const row = buildTurnFeatureRow(
    createOrderedTurnInput({
      turnSequence: 6,
      turnId: "turn-direct-rollup-invalid-scores",
      prompt: "Explain the score guard behavior.",
    }),
    {
      analyzedAt: FIXED_ANALYZED_AT,
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
      signals: {
        retryScore: Number.NaN,
        frictionScore: Number.POSITIVE_INFINITY,
      },
    },
  );

  expect(row.detail.scores).toEqual({
    retry: TURN_FEATURE_SCORE_RANGE.min,
    friction: TURN_FEATURE_SCORE_RANGE.min,
  });
});

test("rollup rejects invalid feature version values", () => {
  expect(() =>
    buildTurnFeatureRow(
      createOrderedTurnInput({
        turnSequence: 7,
        turnId: "turn-direct-rollup-invalid-version",
        prompt: "Explain invalid version handling.",
      }),
      {
        analyzedAt: FIXED_ANALYZED_AT,
        featureVersion: 0,
      },
    ),
  ).toThrow("Turn feature version must be a positive integer.");
});

test("rollup rejects blank analyzed timestamps", () => {
  expect(() =>
    buildTurnFeatureRow(
      createOrderedTurnInput({
        turnSequence: 8,
        turnId: "turn-direct-rollup-blank-analyzed-at",
        prompt: "Explain analyzedAt validation.",
      }),
      {
        analyzedAt: "   ",
        featureVersion: CURRENT_TURN_FEATURE_VERSION,
      },
    ),
  ).toThrow("analyzedAt must be a non-empty timestamp string.");
});

type OrderedTurnInputOverrides = {
  turnSequence: number;
  turnId: string;
  prompt?: string;
  attachments?: unknown[];
  status?: OrderedAnalysisTurnInput["turn"]["status"];
  output?: OrderedAnalysisTurnInput["turn"]["output"];
  error?: OrderedAnalysisTurnInput["turn"]["error"];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    costUsd?: number;
  };
  toolEvents?: Array<{
    toolCallId: string;
    status: OrderedAnalysisTurnInput["toolEvents"][number]["status"];
    toolName?: string;
    outcome?: OrderedAnalysisTurnInput["toolEvents"][number]["outcome"];
  }>;
};

function createOrderedTurnInput(
  overrides: OrderedTurnInputOverrides,
): OrderedAnalysisTurnInput {
  const status = overrides.status ?? "completed";
  const timestamp = createFixtureTimestamp(overrides.turnSequence);

  return {
    turnSequence: overrides.turnSequence,
    turn: {
      provider: "codex",
      sessionId: "session-1",
      turnId: overrides.turnId,
      status,
      input: createTurnInput(overrides),
      output: overrides.output,
      error: overrides.error,
      updatedAt: timestamp,
      completedAt: status === "completed" ? timestamp : undefined,
      failedAt: status === "failed" ? timestamp : undefined,
    },
    usage: overrides.usage
      ? {
          provider: "codex",
          sessionId: "session-1",
          turnId: overrides.turnId,
          inputTokens: overrides.usage.inputTokens,
          outputTokens: overrides.usage.outputTokens,
          cachedInputTokens: overrides.usage.cachedInputTokens,
          costUsd: overrides.usage.costUsd,
          updatedAt: timestamp,
        }
      : undefined,
    toolEvents: (overrides.toolEvents ?? []).map((toolEvent, index) =>
      createToolEvent(overrides.turnSequence, overrides.turnId, toolEvent, index),
    ),
  };
}

function createTurnInput(
  overrides: OrderedTurnInputOverrides,
): OrderedAnalysisTurnInput["turn"]["input"] {
  const hasTurnInput =
    overrides.prompt !== undefined || overrides.attachments !== undefined;

  if (!hasTurnInput) {
    return undefined;
  }

  return {
    prompt: overrides.prompt ?? "",
    attachments: overrides.attachments ?? [],
  };
}

function createToolEvent(
  turnSequence: number,
  turnId: string,
  toolEvent: NonNullable<OrderedTurnInputOverrides["toolEvents"]>[number],
  index: number,
): OrderedAnalysisTurnInput["toolEvents"][number] {
  const timestamp = createFixtureTimestamp(turnSequence, index);

  return {
    provider: "codex",
    sessionId: "session-1",
    turnId,
    toolCallId: toolEvent.toolCallId,
    status: toolEvent.status,
    toolName: toolEvent.toolName,
    outcome: toolEvent.outcome,
    updatedAt: timestamp,
    completedAt: toolEvent.status === "completed" ? timestamp : undefined,
  };
}

function createFixtureTimestamp(
  turnSequence: number,
  second = 0,
): string {
  return `2026-04-18T19:${String(turnSequence).padStart(2, "0")}:${String(
    second,
  ).padStart(2, "0")}.000Z`;
}
