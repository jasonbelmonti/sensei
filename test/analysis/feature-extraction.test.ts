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
      labels: ["text-structure:single-line", "workflow-intent:implement"],
      scores: {
        retry: TURN_FEATURE_SCORE_RANGE.min,
        friction: TURN_FEATURE_SCORE_RANGE.min,
      },
      analyzers: {
        textStructure: {
          applied: true,
          labels: ["single-line"],
          ruleIds: ["text-structure:single-line"],
          counts: {
            lineCount: 1,
            bulletLineCount: 0,
            numberedLineCount: 0,
            codeFenceCount: 0,
            questionLineCount: 0,
          },
          reasons: ["detected a single non-empty line"],
        },
        correctionMarkers: {
          applied: false,
          labels: [],
          ruleIds: [],
          counts: {
            fixCueCount: 0,
            failureCueCount: 0,
            replacementCueCount: 0,
            rollbackCueCount: 0,
            correctionCueCount: 0,
          },
          reasons: [],
        },
        workflowIntent: {
          applied: true,
          labels: ["implement"],
          ruleIds: ["workflow-intent:implement"],
          counts: {
            implement: 1,
            debug: 0,
            review: 0,
            plan: 0,
            explain: 0,
            refactor: 0,
            setup: 0,
            research: 0,
          },
          reasons: ["matched implement intent lexical cues"],
        },
        frictionSignals: {
          applied: false,
          labels: [],
          ruleIds: [],
          counts: {
            retrySourceCount: 0,
            priorFailedTurnCount: 0,
            priorToolFailureCount: 0,
            toolFailureCount: 0,
            errorOutcomeCount: 0,
            cancelledOutcomeCount: 0,
            interruptedToolCallCount: 0,
            repeatedToolCallCount: 0,
            repeatedToolNameCount: 0,
            toolCallCount: 1,
          },
          reasons: [],
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
        ruleIds: ["rollup:base-fields", "text-structure:single-line", "workflow-intent:implement"],
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
    detail: {
      labels: [
        "text-structure:single-line",
        "correction-markers:fix-cue",
        "workflow-intent:debug",
      ],
      analyzers: {
        textStructure: {
          applied: true,
          labels: ["single-line"],
          counts: {
            lineCount: 1,
            bulletLineCount: 0,
            numberedLineCount: 0,
            codeFenceCount: 0,
            questionLineCount: 0,
          },
          reasons: ["detected a single non-empty line"],
        },
        correctionMarkers: {
          applied: true,
          labels: ["fix-cue"],
          counts: {
            fixCueCount: 1,
            failureCueCount: 0,
            replacementCueCount: 0,
            rollbackCueCount: 0,
            correctionCueCount: 0,
          },
          reasons: ["matched fix-oriented lexical cues"],
        },
        workflowIntent: {
          applied: true,
          labels: ["debug"],
          counts: {
            implement: 0,
            debug: 1,
            review: 0,
            plan: 0,
            explain: 0,
            refactor: 0,
            setup: 0,
            research: 0,
          },
          reasons: ["matched debug intent lexical cues"],
        },
      },
    },
    evidence: {
      eligibility: {
        reasons: ["prompt-present"],
        hasPrompt: true,
        hasStructuredOutput: false,
        hasError: true,
      },
      trace: {
        ruleIds: [
          "rollup:base-fields",
          "text-structure:single-line",
          "correction-markers:fix-cue",
          "workflow-intent:debug",
        ],
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

test("feature extraction derives prior-turn retry and friction from ordered turns", () => {
  const extraction = extractTurnFeatures(
    [
      createOrderedTurnInput({
        turnSequence: 20,
        turnId: "turn-baseline",
        prompt: "Explain the baseline analyzer behavior.",
      }),
      createOrderedTurnInput({
        turnSequence: 21,
        turnId: "turn-prior-failed",
        prompt: "Retry after the earlier analyzer failure.",
        status: "failed",
        error: {
          code: "tool-timeout",
          message: "tool call timed out",
        },
      }),
      createOrderedTurnInput({
        turnSequence: 22,
        turnId: "turn-retry-with-friction",
        prompt: "Retry the analyzer and inspect the tool failures.",
        toolEvents: [
          {
            toolCallId: "tool-22a",
            status: "completed",
            toolName: "exec_command",
            outcome: "success",
          },
          {
            toolCallId: "tool-22b",
            status: "completed",
            toolName: "exec_command",
            outcome: "error",
          },
        ],
      }),
    ],
    {
      analyzedAt: FIXED_ANALYZED_AT,
    },
  );

  expect(extraction.rows).toHaveLength(3);
  expect(extraction.rows[2].turnId).toBe("turn-retry-with-friction");
  expect(extraction.rows[2].detail.scores).toEqual({
    retry: 1,
    friction: 2,
  });
  expect(extraction.rows[2].detail.labels).toEqual(
    expect.arrayContaining([
      "friction-signals:prior-turn-retry",
      "friction-signals:tool-failure",
      "friction-signals:repeated-tool",
    ]),
  );
  expect(extraction.rows[2].detail.analyzers.frictionSignals).toEqual({
    applied: true,
    labels: ["prior-turn-retry", "tool-failure", "repeated-tool"],
    ruleIds: [
      "friction-signals:prior-turn-retry",
      "friction-signals:tool-failure",
      "friction-signals:repeated-tool",
    ],
    counts: {
      retrySourceCount: 1,
      priorFailedTurnCount: 1,
      priorToolFailureCount: 0,
      toolFailureCount: 1,
      errorOutcomeCount: 1,
      cancelledOutcomeCount: 0,
      interruptedToolCallCount: 0,
      repeatedToolCallCount: 1,
      repeatedToolNameCount: 1,
      toolCallCount: 2,
    },
    reasons: [
      "detected 1 consecutive prior turn(s) with failed status or failed tool calls",
      "detected 1 tool call(s) with error, cancelled, or interrupted outcomes",
      "detected repeated tool usage across 1 tool name(s)",
    ],
  });
  expect(extraction.rows[2].evidence.trace.priorTurnIds).toEqual([
    "turn-prior-failed",
  ]);
  expect(extraction.rows[2].evidence.trace.toolCallIds).toEqual([
    "tool-22a",
    "tool-22b",
  ]);
});

test("feature extraction preserves skipped failed turns in retry context", () => {
  const extraction = extractTurnFeatures(
    [
      createOrderedTurnInput({
        turnSequence: 30,
        turnId: "turn-skipped-failure",
        status: "failed",
        error: {
          code: "timeout",
          message: "tool call timed out",
        },
      }),
      createOrderedTurnInput({
        turnSequence: 31,
        turnId: "turn-after-skipped-failure",
        prompt: "Retry the analyzer after the earlier failure.",
      }),
    ],
    {
      analyzedAt: FIXED_ANALYZED_AT,
    },
  );

  expect(extraction.summary).toEqual({
    totalTurns: 2,
    eligibleTurns: 1,
    skippedTurns: 1,
  });
  expect(extraction.skipped).toEqual([
    {
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-skipped-failure",
      turnSequence: 30,
      reason: "missing-prompt-input",
    },
  ]);
  expect(extraction.rows).toHaveLength(1);
  expect(extraction.rows[0].turnId).toBe("turn-after-skipped-failure");
  expect(extraction.rows[0].detail.scores).toEqual({
    retry: 1,
    friction: 0,
  });
  expect(extraction.rows[0].detail.labels).toEqual(
    expect.arrayContaining(["friction-signals:prior-turn-retry"]),
  );
  expect(extraction.rows[0].detail.analyzers.frictionSignals).toMatchObject({
    applied: true,
    labels: ["prior-turn-retry"],
    counts: {
      retrySourceCount: 1,
      priorFailedTurnCount: 1,
      priorToolFailureCount: 0,
    },
  });
  expect(extraction.rows[0].evidence.trace.priorTurnIds).toEqual([
    "turn-skipped-failure",
  ]);
});

test("feature extraction preserves skipped blank-prompt tool failures in retry context", () => {
  const extraction = extractTurnFeatures(
    [
      createOrderedTurnInput({
        turnSequence: 32,
        turnId: "turn-skipped-tool-failure",
        prompt: "   ",
        toolEvents: [
          {
            toolCallId: "tool-32a",
            status: "completed",
            toolName: "exec_command",
            outcome: "error",
          },
        ],
      }),
      createOrderedTurnInput({
        turnSequence: 33,
        turnId: "turn-after-skipped-tool-failure",
        prompt: "Retry the analyzer after the tool failure.",
      }),
    ],
    {
      analyzedAt: FIXED_ANALYZED_AT,
    },
  );

  expect(extraction.summary).toEqual({
    totalTurns: 2,
    eligibleTurns: 1,
    skippedTurns: 1,
  });
  expect(extraction.skipped).toEqual([
    {
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-skipped-tool-failure",
      turnSequence: 32,
      reason: "blank-prompt-input",
    },
  ]);
  expect(extraction.rows).toHaveLength(1);
  expect(extraction.rows[0].turnId).toBe("turn-after-skipped-tool-failure");
  expect(extraction.rows[0].detail.scores).toEqual({
    retry: 1,
    friction: 0,
  });
  expect(extraction.rows[0].detail.labels).toEqual(
    expect.arrayContaining(["friction-signals:prior-turn-retry"]),
  );
  expect(extraction.rows[0].detail.analyzers.frictionSignals).toMatchObject({
    applied: true,
    labels: ["prior-turn-retry"],
    counts: {
      retrySourceCount: 1,
      priorFailedTurnCount: 0,
      priorToolFailureCount: 1,
    },
  });
  expect(extraction.rows[0].evidence.trace.priorTurnIds).toEqual([
    "turn-skipped-tool-failure",
  ]);
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
    errorMessage?: string;
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
    errorMessage: toolEvent.errorMessage,
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
