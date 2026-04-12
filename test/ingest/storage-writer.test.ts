import { afterEach, expect, test } from "bun:test";
import type {
  IngestWarning,
  ObservedAgentEvent,
  ObservedSessionRecord,
} from "@jasonbelmonti/claudex/ingest";

import type { SenseiPassiveScanResult } from "../../src/ingest";
import { writePassiveScanResultToStorage } from "../../src/ingest";
import type { SenseiStorage } from "../../src/storage";
import { createStorageTestHarness } from "../storage/helpers";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

test("writer persists mapped passive scan records and preserves canonical state", () => {
  const harness = createStorageTestHarness("sensei-ingest-storage-writer");
  cleanups.push(harness.cleanup);

  const summary = writePassiveScanResultToStorage(
    harness.storage,
    createMixedScanResult(),
  );

  expect(summary).toEqual({
    processedRecords: 5,
    sessionWrites: 5,
    turnWrites: 2,
    turnUsageWrites: 1,
    toolEventWrites: 1,
    cursorWrites: 5,
    warningWrites: 1,
  });

  const storedSession = harness.storage.conversations.getSession("codex", "session-1");
  const storedTurn = harness.storage.conversations.getTurn(
    "codex",
    "session-1",
    "turn-1",
  );
  const storedUsage = harness.storage.conversations.getTurnUsage(
    "codex",
    "session-1",
    "turn-1",
  );
  const toolEvents = harness.storage.conversations.listToolEvents(
    "codex",
    "session-1",
    "turn-1",
  );
  const storedCursor = harness.storage.ingestState.getCursor(
    "codex",
    "/Users/test/.codex",
    "/Users/test/.codex/sessions/session-1.jsonl",
  );
  const warnings = harness.storage.ingestState.listWarnings();

  expect(storedSession).toMatchObject({
    provider: "codex",
    sessionId: "session-1",
    identityState: "canonical",
    workingDirectory: "/repo/sensei",
    metadata: {
      origin: "session-index",
    },
    source: {
      provider: "codex",
      kind: "session-index",
      discoveryPhase: "initial_scan",
      metadata: {
        source: "session-index",
      },
    },
    observationReason: "index",
  });
  expect(storedTurn).toMatchObject({
    provider: "codex",
    sessionId: "session-1",
    turnId: "turn-1",
    status: "completed",
    output: {
      text: "Canonical storage write complete.",
      structuredOutput: {
        ok: true,
      },
      stopReason: "completed",
    },
    extensions: {
      latencyMs: 12,
    },
  });
  expect(storedUsage).toMatchObject({
    provider: "codex",
    sessionId: "session-1",
    turnId: "turn-1",
    inputTokens: 120,
    outputTokens: 45,
    cachedInputTokens: 10,
    providerUsage: {
      requestId: "req-1",
    },
  });
  expect(toolEvents).toEqual([
    expect.objectContaining({
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-1",
      toolCallId: "tool-1",
      status: "completed",
      toolName: "command_execution",
      toolKind: "command",
      outcome: "success",
      output: {
        exitCode: 0,
      },
    }),
  ]);
  expect(storedCursor).toEqual({
    provider: "codex",
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/session-1.jsonl",
    byteOffset: 50,
    line: 5,
    fingerprint: "fp-50",
    continuityToken: "cont-50",
    metadata: {
      observedAt: "reasoning-summary",
    },
    updatedAt: "2026-04-11T12:00:05.000Z",
  });
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatchObject({
    code: "parse-failed",
    provider: "codex",
    filePath: "/Users/test/.codex/sessions/session-1.jsonl",
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "initial_scan",
    },
  });
  expect(countRows(harness.storage, "sessions")).toBe(1);
  expect(countRows(harness.storage, "turns")).toBe(1);
  expect(countRows(harness.storage, "turn_usage")).toBe(1);
  expect(countRows(harness.storage, "tool_events")).toBe(1);
  expect(countRows(harness.storage, "ingest_cursors")).toBe(1);
});

test("writer replay keeps canonical rows stable and warnings append-only", () => {
  const harness = createStorageTestHarness("sensei-ingest-storage-idempotency");
  cleanups.push(harness.cleanup);

  const result = createMixedScanResult();

  writePassiveScanResultToStorage(harness.storage, result);
  writePassiveScanResultToStorage(harness.storage, result);

  expect(countRows(harness.storage, "sessions")).toBe(1);
  expect(countRows(harness.storage, "turns")).toBe(1);
  expect(countRows(harness.storage, "turn_usage")).toBe(1);
  expect(countRows(harness.storage, "tool_events")).toBe(1);
  expect(countRows(harness.storage, "ingest_cursors")).toBe(1);
  expect(harness.storage.ingestState.listWarnings()).toHaveLength(2);
  expect(
    harness.storage.ingestState.getCursor(
      "codex",
      "/Users/test/.codex",
      "/Users/test/.codex/sessions/session-1.jsonl",
    ),
  ).toMatchObject({
    byteOffset: 50,
    line: 5,
  });
});

test("writer uses explicit session provenance even when event records arrive first", () => {
  const harness = createStorageTestHarness("sensei-ingest-session-provenance");
  cleanups.push(harness.cleanup);

  writePassiveScanResultToStorage(
    harness.storage,
    createEventBeforeSessionResult(),
  );

  expect(
    harness.storage.conversations.getSession("codex", "session-1"),
  ).toMatchObject({
    provider: "codex",
    sessionId: "session-1",
    observationReason: "index",
    metadata: {
      origin: "session-index",
    },
    source: {
      kind: "session-index",
      discoveryPhase: "initial_scan",
      filePath: "/Users/test/.codex/sessions/index.json",
      metadata: {
        source: "session-index",
      },
    },
  });
  expect(
    harness.storage.conversations.getTurn("codex", "session-1", "turn-1"),
  ).toMatchObject({
    status: "completed",
  });
});

test("writer keeps cursor progress monotonic during stale replays", () => {
  const harness = createStorageTestHarness("sensei-ingest-storage-monotonic");
  cleanups.push(harness.cleanup);

  writePassiveScanResultToStorage(harness.storage, createCursorOnlyScanResult(200, 20));
  writePassiveScanResultToStorage(harness.storage, createCursorOnlyScanResult(50, 5));

  expect(
    harness.storage.ingestState.getCursor(
      "codex",
      "/Users/test/.codex",
      "/Users/test/.codex/sessions/session-1.jsonl",
    ),
  ).toEqual({
    provider: "codex",
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/session-1.jsonl",
    byteOffset: 200,
    line: 20,
    fingerprint: "fp-200",
    continuityToken: "cont-200",
    metadata: {
      observedAt: "cursor-only",
    },
    updatedAt: "2026-04-11T12:03:20.000Z",
  });
});

function createMixedScanResult(): SenseiPassiveScanResult {
  return {
    records: [
      {
        kind: "session",
        observedSession: createObservedSessionRecord(),
      },
      {
        kind: "event",
        observedEvent: createObservedAgentEvent({
          type: "tool.completed",
          provider: "codex",
          session: {
            provider: "codex",
            sessionId: "session-1",
          },
          turnId: "turn-1",
          toolCallId: "tool-1",
          toolName: "command_execution",
          kind: "command",
          outcome: "success",
          output: {
            exitCode: 0,
          },
          timestamp: "2026-04-11T12:00:02.000Z",
          raw: {
            step: "tool-complete",
          },
        }, 2, 20, "tool-complete"),
      },
      {
        kind: "event",
        observedEvent: createObservedAgentEvent({
          type: "message.completed",
          provider: "codex",
          session: {
            provider: "codex",
            sessionId: "session-1",
          },
          turnId: "turn-1",
          role: "assistant",
          text: "Intermediate assistant text.",
          timestamp: "2026-04-11T12:00:03.000Z",
          raw: {
            step: "message-complete",
          },
        }, 3, 30, "message-complete"),
      },
      {
        kind: "event",
        observedEvent: createObservedAgentEvent({
          type: "turn.completed",
          provider: "codex",
          session: {
            provider: "codex",
            sessionId: "session-1",
          },
          turnId: "turn-1",
          timestamp: "2026-04-11T12:00:04.000Z",
          result: {
            provider: "codex",
            session: {
              provider: "codex",
              sessionId: "session-1",
            },
            turnId: "turn-1",
            text: "Canonical storage write complete.",
            structuredOutput: {
              ok: true,
            },
            usage: {
              tokens: {
                input: 120,
                output: 45,
                cachedInput: 10,
              },
              providerUsage: {
                requestId: "req-1",
              },
            },
            stopReason: "completed",
            raw: {
              step: "turn-complete",
            },
            extensions: {
              latencyMs: 12,
            },
          },
          raw: {
            step: "turn-complete-event",
          },
        }, 4, 40, "turn-complete"),
      },
      {
        kind: "event",
        observedEvent: createObservedAgentEvent({
          type: "reasoning.summary",
          provider: "codex",
          session: {
            provider: "codex",
            sessionId: "session-1",
          },
          turnId: "turn-1",
          summary: "Mapped passive ingest into canonical storage.",
          timestamp: "2026-04-11T12:00:05.000Z",
          raw: {
            step: "reasoning-summary",
          },
        }, 5, 50, "reasoning-summary"),
      },
    ],
    warnings: [createTopLevelWarning()],
    discoveryEvents: [
      {
        type: "scan.completed",
        provider: "codex",
        rootPath: "/Users/test/.codex",
        discoveryPhase: "initial_scan",
      },
    ],
  };
}

function createEventBeforeSessionResult(): SenseiPassiveScanResult {
  return {
    records: [
      {
        kind: "event",
        observedEvent: createObservedAgentEvent({
          type: "turn.completed",
          provider: "codex",
          session: {
            provider: "codex",
            sessionId: "session-1",
          },
          turnId: "turn-1",
          timestamp: "2026-04-11T12:00:04.000Z",
          result: {
            provider: "codex",
            session: {
              provider: "codex",
              sessionId: "session-1",
            },
            turnId: "turn-1",
            text: "Out-of-order session provenance.",
            usage: null,
          },
          raw: {
            step: "turn-complete-before-session",
          },
        }, 4, 40, "turn-complete-before-session"),
      },
      {
        kind: "session",
        observedSession: createObservedSessionRecord(),
      },
    ],
    warnings: [],
    discoveryEvents: [],
  };
}

function createCursorOnlyScanResult(
  byteOffset: number,
  line: number,
): SenseiPassiveScanResult {
  const updatedAt = `2026-04-11T12:03:${String(line).padStart(2, "0")}.000Z`;

  return {
    records: [
      {
        kind: "event",
        observedEvent: createObservedAgentEvent({
          type: "message.completed",
          provider: "codex",
          session: {
            provider: "codex",
            sessionId: "session-1",
          },
          turnId: "turn-1",
          role: "assistant",
          text: "Cursor-only replay.",
          timestamp: updatedAt,
          raw: {
            step: "cursor-only",
          },
        }, line, byteOffset, "cursor-only", updatedAt),
      },
    ],
    warnings: [],
    discoveryEvents: [],
  };
}

function createObservedSessionRecord(): ObservedSessionRecord {
  return {
    kind: "session",
    observedSession: {
      provider: "codex",
      sessionId: "session-1",
      state: "canonical",
      workingDirectory: "/repo/sensei",
      metadata: {
        origin: "session-index",
      },
    },
    source: {
      provider: "codex",
      kind: "session-index",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/index.json",
      location: {
        line: 1,
        byteOffset: 0,
      },
      metadata: {
        source: "session-index",
      },
    },
    completeness: "complete",
    reason: "index",
    cursor: {
      provider: "codex",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
      byteOffset: 10,
      line: 1,
      fingerprint: "fp-10",
      continuityToken: "cont-10",
      updatedAt: "2026-04-11T12:00:01.000Z",
      metadata: {
        observedAt: "session-index",
      },
    },
  };
}

function createObservedAgentEvent(
  event: ObservedAgentEvent["event"],
  line: number,
  byteOffset: number,
  observedAt: string,
  updatedAt?: string,
): ObservedAgentEvent {
  return {
    kind: "event",
    event,
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
      location: {
        line,
        byteOffset,
      },
      metadata: {
        source: "transcript",
      },
    },
    observedSession: {
      provider: "codex",
      sessionId: "session-1",
      state: "canonical",
      workingDirectory: "/repo/sensei",
      metadata: {
        origin: "transcript",
      },
    },
    completeness: "complete",
    cursor: {
      provider: "codex",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
      byteOffset,
      line,
      fingerprint: `fp-${byteOffset}`,
      continuityToken: `cont-${byteOffset}`,
      updatedAt: updatedAt ?? `2026-04-11T12:00:0${Math.min(line, 9)}.000Z`,
      metadata: {
        observedAt,
      },
    },
  };
}

function createTopLevelWarning(): IngestWarning {
  return {
    code: "parse-failed",
    message: "Skipped malformed JSON payload.",
    provider: "codex",
    filePath: "/Users/test/.codex/sessions/session-1.jsonl",
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "initial_scan",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
      location: {
        line: 9,
        byteOffset: 90,
      },
      metadata: {
        source: "transcript",
      },
    },
    raw: {
      preview: "{oops",
    },
  };
}

function countRows(storage: SenseiStorage, table: string): number {
  const row = storage.database
    .query(`SELECT COUNT(*) as count FROM ${table}`)
    .get() as { count: number };

  return row.count;
}
