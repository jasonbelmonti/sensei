import { afterEach, expect, test } from "bun:test";
import type {
  IngestCursor,
  IngestWarning,
  ObservedAgentEvent,
  ObservedSessionRecord,
  SessionIngestService,
  SessionIngestServiceOptions,
} from "@jasonbelmonti/claudex/ingest";

import { createSenseiConfig } from "../../src/config";
import { createSenseiIngestWatch } from "../../src/ingest";
import { openSenseiStorage, type SenseiStorage } from "../../src/storage";
import { createStorageTestHarness } from "../storage/helpers";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

test("watch persists appended history through storage-backed cursor continuity", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch");
  cleanups.push(harness.cleanup);

  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });
  const observedCursors: Array<IngestCursor | null> = [];

  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return createFirstWatchRunService(options, observedCursors);
    },
  });
  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return createSecondWatchRunService(options, observedCursors);
    },
  });

  const storage = openSenseiStorage({
    databasePath: harness.databasePath,
  });
  cleanups.push(() => storage.close());

  expect(observedCursors).toEqual([
    null,
    expect.objectContaining({
      provider: "codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
      byteOffset: 20,
      line: 2,
    }),
  ]);
  expect(countRows(storage, "sessions")).toBe(1);
  expect(countRows(storage, "turns")).toBe(1);
  expect(countRows(storage, "turn_usage")).toBe(1);
  expect(countRows(storage, "ingest_cursors")).toBe(1);
  expect(storage.conversations.getSession("codex", "session-1")).toMatchObject({
    provider: "codex",
    sessionId: "session-1",
    source: {
      discoveryPhase: "watch",
    },
  });
  expect(storage.conversations.getTurn("codex", "session-1", "turn-1")).toMatchObject({
    provider: "codex",
    turnId: "turn-1",
    status: "completed",
    startedAt: "2026-04-11T12:00:01.000Z",
    completedAt: "2026-04-11T12:00:04.000Z",
  });
  expect(
    storage.ingestState.getCursor(
      "codex",
      "/Users/test/.codex",
      "/Users/test/.codex/sessions/session-1.jsonl",
    ),
  ).toMatchObject({
    byteOffset: 40,
    line: 4,
  });
});

test("watch persists canonical warning rows emitted by the service", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch-warnings");
  cleanups.push(harness.cleanup);
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });

  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return {
        roots: options.roots,
        async start() {
          for (const code of [
            "watch-failed",
            "cursor-reset",
            "rotated-file",
            "truncated-file",
            "file-open-failed",
          ] as const) {
            await options.onWarning?.(createWarning(code));
          }
        },
        async scanNow() {},
        async reconcileNow() {},
        async stop() {},
      };
    },
  });

  const warnings = harness.storage.ingestState.listWarnings();

  expect(warnings.map((warning) => warning.code)).toEqual([
    "watch-failed",
    "cursor-reset",
    "rotated-file",
    "truncated-file",
    "file-open-failed",
  ]);
});

test("watch does not persist cursors from observed records without cursor-store advancement", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch-no-record-cursor");
  cleanups.push(harness.cleanup);
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });

  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return {
        roots: options.roots,
        async start() {
          await options.onObservedEvent?.(
            createObservedEvent({
              type: "turn.started",
              provider: "codex",
              session: {
                provider: "codex",
                sessionId: "session-1",
              },
              turnId: "turn-1",
              input: {
                prompt: "Do not persist cursor from record callbacks.",
                attachments: [],
              },
              timestamp: "2026-04-11T12:00:01.000Z",
            }, {
              line: 9,
              byteOffset: 90,
              discoveryPhase: "watch",
            }),
          );
        },
        async scanNow() {},
        async reconcileNow() {},
        async stop() {},
      };
    },
  });

  expect(countRows(harness.storage, "ingest_cursors")).toBe(0);
});

test("watch preserves later authoritative explicit session updates", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch-explicit-session");
  cleanups.push(harness.cleanup);
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });

  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return {
        roots: options.roots,
        async start() {
          await options.onObservedEvent?.(
            createObservedEvent({
              type: "turn.started",
              provider: "codex",
              session: {
                provider: "codex",
                sessionId: "session-1",
              },
              turnId: "turn-1",
              input: {
                prompt: "Prefer explicit session provenance.",
                attachments: [],
              },
              timestamp: "2026-04-11T12:00:01.000Z",
            }, {
              line: 2,
              byteOffset: 20,
              discoveryPhase: "watch",
            }),
          );
          await options.onObservedSession?.(
            createObservedSessionRecord({
              metadata: {
                origin: "session-index",
              },
              source: {
                kind: "session-index",
                discoveryPhase: "watch",
                filePath: "/Users/test/.codex/session-index.jsonl",
              },
              reason: "index",
            }),
          );
        },
        async scanNow() {},
        async reconcileNow() {},
        async stop() {},
      };
    },
  });

  expect(harness.storage.conversations.getSession("codex", "session-1")).toMatchObject({
    identityState: "canonical",
    completeness: "complete",
    observationReason: "index",
    metadata: {
      origin: "session-index",
    },
    source: {
      kind: "session-index",
      discoveryPhase: "watch",
      filePath: "/Users/test/.codex/session-index.jsonl",
    },
  });
});

test("watch preserves event observedAt when explicit sessions arrive first", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch-observed-at");
  cleanups.push(harness.cleanup);
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });

  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return {
        roots: options.roots,
        async start() {
          await options.onObservedSession?.(createObservedSessionRecord());
          await options.onObservedEvent?.(
            createObservedEvent({
              type: "turn.started",
              provider: "codex",
              session: {
                provider: "codex",
                sessionId: "session-1",
              },
              turnId: "turn-1",
              input: {
                prompt: "Preserve transcript observedAt.",
                attachments: [],
              },
              timestamp: "2026-04-11T12:00:01.000Z",
            }, {
              line: 2,
              byteOffset: 20,
              discoveryPhase: "watch",
            }),
          );
        },
        async scanNow() {},
        async reconcileNow() {},
        async stop() {},
      };
    },
  });

  expect(harness.storage.conversations.getSession("codex", "session-1")).toMatchObject({
    observationReason: "index",
    source: {
      kind: "session-index",
      filePath: "/Users/test/.codex/session-index.jsonl",
    },
    observedAt: "2026-04-11T12:00:01.000Z",
  });
});

test("watch authoritative session updates preserve prior optional fields when sparse", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch-sparse-explicit-session");
  cleanups.push(harness.cleanup);
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });

  await runWatchLifecycle(config, harness.databasePath, {
    createService(options) {
      return {
        roots: options.roots,
        async start() {
          await options.onObservedEvent?.(
            createObservedEvent({
              type: "turn.started",
              provider: "codex",
              session: {
                provider: "codex",
                sessionId: "session-1",
              },
              turnId: "turn-1",
              input: {
                prompt: "Keep working directory and metadata.",
                attachments: [],
              },
              timestamp: "2026-04-11T12:00:01.000Z",
            }, {
              line: 2,
              byteOffset: 20,
              discoveryPhase: "watch",
            }, {
              observedSession: {
                workingDirectory: "/repo/sensei",
                metadata: {
                  origin: "transcript",
                },
              },
            }),
          );
          await options.onObservedSession?.(
            createObservedSessionRecord({
              source: {
                kind: "session-index",
                discoveryPhase: "watch",
                filePath: "/Users/test/.codex/session-index.jsonl",
              },
            }),
          );
        },
        async scanNow() {},
        async reconcileNow() {},
        async stop() {},
      };
    },
  });

  expect(harness.storage.conversations.getSession("codex", "session-1")).toMatchObject({
    workingDirectory: "/repo/sensei",
    metadata: {
      origin: "transcript",
    },
    source: {
      kind: "session-index",
      filePath: "/Users/test/.codex/session-index.jsonl",
    },
  });
});

test("watch delegates reconcile to the underlying service and persists emitted records", async () => {
  const harness = createStorageTestHarness("sensei-ingest-watch-reconcile");
  cleanups.push(harness.cleanup);
  const config = createSenseiConfig({
    repoRoot: "/repo/sensei",
    homeDir: "/Users/test",
    env: {
      SENSEI_HOME: harness.rootDir,
      SENSEI_CLAUDE_ROOT: "/Users/test/.claude",
      SENSEI_CODEX_ROOT: "/Users/test/.codex",
    },
  });
  let reconcileCalls = 0;
  let stopCalls = 0;

  const watch = createSenseiIngestWatch(config, {
    storage: harness.storage,
    createService(options) {
      return {
        roots: options.roots,
        async start() {},
        async scanNow() {},
        async reconcileNow() {
          reconcileCalls += 1;
          await options.onObservedEvent?.(
            createObservedEvent({
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
                text: "Reconciled transcript.",
                usage: null,
              },
            }, {
              line: 4,
              byteOffset: 40,
              discoveryPhase: "reconcile",
            }),
          );
        },
        async stop() {
          stopCalls += 1;
        },
      };
    },
  });

  expect(watch.roots.every((root) => root.watch)).toBe(true);

  await watch.start();
  await watch.reconcileNow();
  await watch.stop();

  expect(reconcileCalls).toBe(1);
  expect(stopCalls).toBe(1);
  expect(harness.storage.conversations.getTurn("codex", "session-1", "turn-1")).toMatchObject({
    status: "completed",
    completedAt: "2026-04-11T12:00:04.000Z",
  });
});

async function runWatchLifecycle(
  config: ReturnType<typeof createSenseiConfig>,
  databasePath: string,
  options: {
    createService: (options: SessionIngestServiceOptions) => SessionIngestService;
  },
): Promise<void> {
  const storage = openSenseiStorage({
    databasePath,
  });

  try {
    const watch = createSenseiIngestWatch(config, {
      storage,
      createService: options.createService,
    });

    await watch.start();
    await watch.stop();
  } finally {
    storage.close();
  }
}

function createFirstWatchRunService(
  options: SessionIngestServiceOptions,
  observedCursors: Array<IngestCursor | null>,
): SessionIngestService {
  const event = createObservedEvent({
    type: "turn.started",
    provider: "codex",
    session: {
      provider: "codex",
      sessionId: "session-1",
    },
    turnId: "turn-1",
    input: {
      prompt: "Implement BEL-670.",
      attachments: [],
    },
    timestamp: "2026-04-11T12:00:01.000Z",
  }, {
    line: 2,
    byteOffset: 20,
    discoveryPhase: "watch",
  });

  return {
    roots: options.roots,
    async start() {
      observedCursors.push(
        (await options.cursorStore?.get(createCursorKey())) ?? null,
      );
      await options.onObservedEvent?.(event);
      await options.cursorStore?.set(requireCursor(event));
    },
    async scanNow() {},
    async reconcileNow() {},
    async stop() {},
  };
}

function createSecondWatchRunService(
  options: SessionIngestServiceOptions,
  observedCursors: Array<IngestCursor | null>,
): SessionIngestService {
  const event = createObservedEvent({
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
      text: "Implemented BEL-670.",
      usage: {
        tokens: {
          input: 120,
          output: 40,
          cachedInput: 5,
        },
      },
      stopReason: "completed",
    },
  }, {
    line: 4,
    byteOffset: 40,
    discoveryPhase: "watch",
  });

  return {
    roots: options.roots,
    async start() {
      observedCursors.push(
        (await options.cursorStore?.get(createCursorKey())) ?? null,
      );
      await options.onObservedEvent?.(event);
      await options.cursorStore?.set(requireCursor(event));
    },
    async scanNow() {},
    async reconcileNow() {},
    async stop() {},
  };
}

function createCursorKey() {
  return {
    provider: "codex" as const,
    rootPath: "/Users/test/.codex",
    filePath: "/Users/test/.codex/sessions/session-1.jsonl",
  };
}

function createObservedEvent(
  event: ObservedAgentEvent["event"],
  location: {
    line: number;
    byteOffset: number;
    discoveryPhase: "watch" | "reconcile";
  },
  overrides: {
    observedSession?: {
      workingDirectory?: string;
      metadata?: Record<string, unknown>;
    };
  } = {},
): ObservedAgentEvent {
  return {
    kind: "event",
    event,
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: location.discoveryPhase,
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
      location: {
        line: location.line,
        byteOffset: location.byteOffset,
      },
    },
    observedSession: {
      provider: "codex",
      sessionId: "session-1",
      state: "canonical",
      workingDirectory: overrides.observedSession?.workingDirectory,
      metadata: overrides.observedSession?.metadata,
    },
    completeness: "complete",
    cursor: {
      ...createCursorKey(),
      byteOffset: location.byteOffset,
      line: location.line,
      fingerprint: `fp-${location.byteOffset}`,
      continuityToken: `cont-${location.byteOffset}`,
      updatedAt: `2026-04-11T12:00:0${Math.min(location.line, 9)}.000Z`,
    },
  };
}

function createObservedSessionRecord(overrides: {
  metadata?: Record<string, unknown>;
  source?: Partial<ObservedSessionRecord["source"]>;
  reason?: ObservedSessionRecord["reason"];
} = {}): ObservedSessionRecord {
  return {
    kind: "session",
    observedSession: {
      provider: "codex",
      sessionId: "session-1",
      state: "canonical",
      metadata: overrides.metadata,
    },
    source: {
      provider: "codex",
      kind: overrides.source?.kind ?? "session-index",
      discoveryPhase: overrides.source?.discoveryPhase ?? "watch",
      rootPath: overrides.source?.rootPath ?? "/Users/test/.codex",
      filePath:
        overrides.source?.filePath ?? "/Users/test/.codex/session-index.jsonl",
      location: overrides.source?.location,
      metadata: overrides.source?.metadata,
    },
    completeness: "complete",
    reason: overrides.reason ?? "index",
    cursor: {
      provider: "codex",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/session-index.jsonl",
      byteOffset: 1,
      line: 1,
    },
  };
}

function createWarning(code: IngestWarning["code"]): IngestWarning {
  return {
    code,
    message: `${code} warning`,
    provider: "codex",
    filePath: "/Users/test/.codex/sessions/session-1.jsonl",
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: "watch",
      rootPath: "/Users/test/.codex",
      filePath: "/Users/test/.codex/sessions/session-1.jsonl",
    },
  };
}

function requireCursor(event: ObservedAgentEvent): IngestCursor {
  if (!event.cursor) {
    throw new Error("Expected observed event cursor in watch test fixture.");
  }

  return event.cursor;
}

function countRows(storage: SenseiStorage, table: string): number {
  const row = storage.database
    .query(`SELECT COUNT(*) as count FROM ${table}`)
    .get() as { count: number };

  return row.count;
}
