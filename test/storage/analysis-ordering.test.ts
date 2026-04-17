import { expect, test } from "bun:test";

import {
  ANALYSIS_TOOL_EVENT_ORDER_COLUMNS,
  ANALYSIS_TURN_ORDER_COLUMNS,
  sortAnalysisToolEvents,
  sortAnalysisTurns,
} from "../../src/storage";

test("analysis turn ordering is deterministic across lifecycle timestamp fallbacks", () => {
  expect(ANALYSIS_TURN_ORDER_COLUMNS).toEqual([
    "started_at",
    "completed_at",
    "failed_at",
    "updated_at",
    "turn_id",
  ]);

  const orderedTurnIds = sortAnalysisTurns([
    {
      turnId: "turn-05",
      updatedAt: "2026-04-11T12:00:04.000Z",
    },
    {
      turnId: "turn-03",
      completedAt: "2026-04-11T12:00:02.000Z",
      updatedAt: "2026-04-11T12:00:02.500Z",
    },
    {
      turnId: "turn-02",
      startedAt: "2026-04-11T12:00:01.000Z",
      updatedAt: "2026-04-11T12:00:01.500Z",
    },
    {
      turnId: "turn-01",
      startedAt: "2026-04-11T12:00:01.000Z",
      updatedAt: "2026-04-11T12:00:01.250Z",
    },
    {
      turnId: "turn-04",
      failedAt: "2026-04-11T12:00:03.000Z",
      updatedAt: "2026-04-11T12:00:03.500Z",
    },
  ]).map((turn) => turn.turnId);

  expect(orderedTurnIds).toEqual([
    "turn-01",
    "turn-02",
    "turn-03",
    "turn-04",
    "turn-05",
  ]);
});

test("analysis tool event ordering is deterministic across lifecycle timestamp fallbacks", () => {
  expect(ANALYSIS_TOOL_EVENT_ORDER_COLUMNS).toEqual([
    "started_at",
    "completed_at",
    "updated_at",
    "tool_call_id",
  ]);

  const orderedToolCallIds = sortAnalysisToolEvents([
    {
      toolCallId: "tool-03",
      completedAt: "2026-04-11T12:00:02.000Z",
      updatedAt: "2026-04-11T12:00:02.500Z",
    },
    {
      toolCallId: "tool-02",
      startedAt: "2026-04-11T12:00:01.000Z",
      updatedAt: "2026-04-11T12:00:01.500Z",
    },
    {
      toolCallId: "tool-01",
      startedAt: "2026-04-11T12:00:01.000Z",
      updatedAt: "2026-04-11T12:00:01.250Z",
    },
    {
      toolCallId: "tool-04",
      updatedAt: "2026-04-11T12:00:03.000Z",
    },
  ]).map((toolEvent) => toolEvent.toolCallId);

  expect(orderedToolCallIds).toEqual([
    "tool-01",
    "tool-02",
    "tool-03",
    "tool-04",
  ]);
});
