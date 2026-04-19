import { expect, test } from "bun:test";

import { buildFrictionSignals } from "../../src/analysis";
import type { OrderedAnalysisTurnInput } from "../../src/storage";

test("friction analyzer emits retry context from consecutive prior failure turns", () => {
  const signals = buildFrictionSignals(
    createOrderedTurnInput({
      turnSequence: 4,
      turnId: "turn-4",
      prompt: "Retry the analyzer after earlier failures.",
    }),
    {
      priorTurns: [
        createOrderedTurnInput({
          turnSequence: 1,
          turnId: "turn-1",
          prompt: "Explain the analyzer contract.",
        }),
        createOrderedTurnInput({
          turnSequence: 2,
          turnId: "turn-2",
          prompt: "Retry after the failed turn.",
          status: "failed",
          error: {
            code: "timeout",
            message: "request timed out",
          },
        }),
        createOrderedTurnInput({
          turnSequence: 3,
          turnId: "turn-3",
          prompt: "Retry after the tool error.",
          toolEvents: [
            {
              toolCallId: "tool-3a",
              status: "completed",
              toolName: "exec_command",
              outcome: "error",
            },
          ],
        }),
      ],
    },
  );

  expect(signals).toEqual({
    labels: ["friction-signals:prior-turn-retry"],
    retryScore: 2,
    frictionScore: 0,
    analyzers: {
      frictionSignals: {
        applied: true,
        labels: ["prior-turn-retry"],
        ruleIds: ["friction-signals:prior-turn-retry"],
        counts: {
          retrySourceCount: 2,
          priorFailedTurnCount: 1,
          priorToolFailureCount: 1,
          toolFailureCount: 0,
          errorOutcomeCount: 0,
          cancelledOutcomeCount: 0,
          interruptedToolCallCount: 0,
          repeatedToolCallCount: 0,
          repeatedToolNameCount: 0,
          toolCallCount: 0,
        },
        reasons: [
          "detected 2 consecutive prior turn(s) with failed status or failed tool calls",
        ],
      },
    },
    ruleIds: ["friction-signals:prior-turn-retry"],
    priorTurnIds: ["turn-2", "turn-3"],
  });
});

test("friction analyzer emits tool failure and repeated tool labels from canonical tool events", () => {
  const signals = buildFrictionSignals(
    createOrderedTurnInput({
      turnSequence: 5,
      turnId: "turn-5",
      prompt: "Debug the repeated tool failures.",
      status: "failed",
      error: {
        code: "tool-failure",
        message: "tool execution failed",
      },
      toolEvents: [
        {
          toolCallId: "tool-5a",
          status: "completed",
          toolName: "exec_command",
          outcome: "success",
        },
        {
          toolCallId: "tool-5b",
          status: "completed",
          toolName: "exec_command",
          outcome: "cancelled",
        },
        {
          toolCallId: "tool-5c",
          status: "started",
          toolName: "read_resource",
        },
      ],
    }),
  );

  expect(signals).toEqual({
    labels: [
      "friction-signals:tool-failure",
      "friction-signals:repeated-tool",
    ],
    retryScore: 0,
    frictionScore: 3,
    analyzers: {
      frictionSignals: {
        applied: true,
        labels: ["tool-failure", "repeated-tool"],
        ruleIds: [
          "friction-signals:tool-failure",
          "friction-signals:repeated-tool",
        ],
        counts: {
          retrySourceCount: 0,
          priorFailedTurnCount: 0,
          priorToolFailureCount: 0,
          toolFailureCount: 2,
          errorOutcomeCount: 0,
          cancelledOutcomeCount: 1,
          interruptedToolCallCount: 1,
          repeatedToolCallCount: 1,
          repeatedToolNameCount: 1,
          toolCallCount: 3,
        },
        reasons: [
          "detected 2 tool call(s) with error, cancelled, or interrupted outcomes",
          "detected repeated tool usage across 1 tool name(s)",
        ],
      },
    },
    ruleIds: [
      "friction-signals:tool-failure",
      "friction-signals:repeated-tool",
    ],
    priorTurnIds: [],
  });
});

type OrderedTurnInputOverrides = {
  turnSequence: number;
  turnId: string;
  prompt?: string;
  status?: OrderedAnalysisTurnInput["turn"]["status"];
  error?: OrderedAnalysisTurnInput["turn"]["error"];
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
      input: {
        prompt: overrides.prompt ?? "",
        attachments: [],
      },
      error: overrides.error,
      updatedAt: timestamp,
      completedAt: status === "completed" ? timestamp : undefined,
      failedAt: status === "failed" ? timestamp : undefined,
    },
    toolEvents: (overrides.toolEvents ?? []).map((toolEvent, index) =>
      createToolEvent(overrides.turnId, overrides.turnSequence, toolEvent, index),
    ),
  };
}

function createToolEvent(
  turnId: string,
  turnSequence: number,
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
  return `2026-04-18T20:${String(turnSequence).padStart(2, "0")}:${String(
    second,
  ).padStart(2, "0")}.000Z`;
}
