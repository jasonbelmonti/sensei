import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";

import {
  ANALYSIS_TOOL_EVENT_ORDER_BY_SQL,
  ANALYSIS_TOOL_EVENT_ORDER_BY_SQL_TERMS,
  ANALYSIS_TURN_ORDER_BY_SQL,
  ANALYSIS_TURN_ORDER_BY_SQL_TERMS,
  sortAnalysisToolEvents,
  sortAnalysisTurns,
} from "../../src/storage";

type TestAnalysisTurn = {
  turnId: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  updatedAt: string;
};

type TestAnalysisToolEvent = {
  toolCallId: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

test("analysis turn ordering uses the coalesced SQL timestamp contract", () => {
  expect(ANALYSIS_TURN_ORDER_BY_SQL_TERMS).toEqual([
    "COALESCE(started_at, completed_at, failed_at, updated_at)",
    "turn_id",
  ]);
  expect(ANALYSIS_TURN_ORDER_BY_SQL).toBe(
    "COALESCE(started_at, completed_at, failed_at, updated_at), turn_id",
  );

  const turns: TestAnalysisTurn[] = [
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
  ];

  const orderedTurnIds = sortAnalysisTurns(turns).map((turn) => turn.turnId);

  expect(orderedTurnIds).toEqual([
    "turn-01",
    "turn-02",
    "turn-03",
    "turn-04",
    "turn-05",
  ]);

  const database = new Database(":memory:");

  try {
    database.exec(`
      CREATE TABLE turns (
        turn_id TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    const insertTurnStatement = database.query(`
      INSERT INTO turns (
        turn_id,
        started_at,
        completed_at,
        failed_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const turn of turns) {
      insertTurnStatement.run(
        turn.turnId,
        turn.startedAt ?? null,
        turn.completedAt ?? null,
        turn.failedAt ?? null,
        turn.updatedAt,
      );
    }

    const sqlOrderedTurnIds = database
      .query(`
        SELECT turn_id as turnId
        FROM turns
        ORDER BY ${ANALYSIS_TURN_ORDER_BY_SQL}
      `)
      .all()
      .map((row) => (row as { turnId: string }).turnId);

    expect(sqlOrderedTurnIds).toEqual(orderedTurnIds);
  } finally {
    database.close();
  }
});

test("analysis tool event ordering uses the coalesced SQL timestamp contract", () => {
  expect(ANALYSIS_TOOL_EVENT_ORDER_BY_SQL_TERMS).toEqual([
    "COALESCE(started_at, completed_at, updated_at)",
    "tool_call_id",
  ]);
  expect(ANALYSIS_TOOL_EVENT_ORDER_BY_SQL).toBe(
    "COALESCE(started_at, completed_at, updated_at), tool_call_id",
  );

  const toolEvents: TestAnalysisToolEvent[] = [
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
  ];

  const orderedToolCallIds = sortAnalysisToolEvents(toolEvents).map(
    (toolEvent) => toolEvent.toolCallId,
  );

  expect(orderedToolCallIds).toEqual([
    "tool-01",
    "tool-02",
    "tool-03",
    "tool-04",
  ]);

  const database = new Database(":memory:");

  try {
    database.exec(`
      CREATE TABLE tool_events (
        tool_call_id TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    const insertToolEventStatement = database.query(`
      INSERT INTO tool_events (
        tool_call_id,
        started_at,
        completed_at,
        updated_at
      ) VALUES (?, ?, ?, ?)
    `);

    for (const toolEvent of toolEvents) {
      insertToolEventStatement.run(
        toolEvent.toolCallId,
        toolEvent.startedAt ?? null,
        toolEvent.completedAt ?? null,
        toolEvent.updatedAt,
      );
    }

    const sqlOrderedToolCallIds = database
      .query(`
        SELECT tool_call_id as toolCallId
        FROM tool_events
        ORDER BY ${ANALYSIS_TOOL_EVENT_ORDER_BY_SQL}
      `)
      .all()
      .map((row) => (row as { toolCallId: string }).toolCallId);

    expect(sqlOrderedToolCallIds).toEqual(orderedToolCallIds);
  } finally {
    database.close();
  }
});
