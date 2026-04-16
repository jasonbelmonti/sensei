import type {
  DiscoveryEvent,
  IngestCursor,
  IngestWarning,
  ObservedAgentEvent,
  ObservedSessionRecord,
  SessionIngestService,
  SessionIngestServiceOptions,
} from "@jasonbelmonti/claudex/ingest";
import { join } from "node:path";

import type { SenseiPassiveScanResult } from "../../src/ingest";

type FixtureDiscoveryPhase = "initial_scan" | "watch";

export const fixtureThreadName = "BEL-671 contract session";
export const fixtureSessionId = "session-1";
export const fixtureCodexRoot = "/Users/test/.codex";
export const fixtureTranscriptPath = join(
  fixtureCodexRoot,
  "sessions/session-1.jsonl",
);

export function createBaselineScanResult(codexRoot: string): SenseiPassiveScanResult {
  return createScanResult(codexRoot, {
    records: [
      {
        kind: "session",
        observedSession: createObservedSessionRecord(codexRoot),
      },
      {
        kind: "event",
        observedEvent: createObservedEvent(
          {
            type: "turn.started",
            provider: "codex",
            session: {
              provider: "codex",
              sessionId: fixtureSessionId,
            },
            turnId: "turn-1",
            input: {
              prompt: "Establish baseline scan state.",
              attachments: [],
            },
            timestamp: "2026-04-11T12:00:01.000Z",
          },
          createEventLocation(2, 20, "initial_scan"),
        ),
      },
    ],
  });
}

export function createWarningOnlyScanResult(
  codexRoot: string,
): SenseiPassiveScanResult {
  return createScanResult(codexRoot, {
    records: [],
    warnings: [
      createWarning("parse-failed", {
        discoveryPhase: "initial_scan",
      }),
    ],
  });
}

export function createWatchContinuationService(
  options: SessionIngestServiceOptions,
  observedCursors: Array<IngestCursor | null>,
): SessionIngestService {
  const event = createObservedEvent(
    {
      type: "turn.completed",
      provider: "codex",
      session: {
        provider: "codex",
        sessionId: fixtureSessionId,
      },
      turnId: "turn-1",
      timestamp: "2026-04-11T12:00:04.000Z",
      result: {
        provider: "codex",
        session: {
          provider: "codex",
          sessionId: fixtureSessionId,
        },
        turnId: "turn-1",
        text: "Watch continued from the stored scan cursor.",
        usage: {
          tokens: {
            input: 120,
            output: 40,
            cachedInput: 5,
          },
        },
        stopReason: "completed",
      },
    },
    createEventLocation(4, 40, "watch"),
  );

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

export function createWarningWatchService(
  options: SessionIngestServiceOptions,
  code: IngestWarning["code"],
): SessionIngestService {
  return {
    roots: options.roots,
    async start() {
      await options.onWarning?.(
        createWarning(code, {
          discoveryPhase: "watch",
        }),
      );
    },
    async scanNow() {},
    async reconcileNow() {},
    async stop() {},
  };
}

function createScanResult(
  codexRoot: string,
  result: {
    records: SenseiPassiveScanResult["records"];
    warnings?: SenseiPassiveScanResult["warnings"];
  },
): SenseiPassiveScanResult {
  return {
    records: result.records,
    warnings: result.warnings ?? [],
    discoveryEvents: [createDiscoveryEvent(codexRoot)],
  };
}

function createObservedSessionRecord(codexRoot: string): ObservedSessionRecord {
  const sessionIndexPath = join(codexRoot, "session-index.jsonl");

  return {
    kind: "session",
    observedSession: {
      provider: "codex",
      sessionId: fixtureSessionId,
      state: "canonical",
      metadata: {
        threadName: fixtureThreadName,
      },
    },
    source: {
      provider: "codex",
      kind: "session-index",
      discoveryPhase: "initial_scan",
      rootPath: codexRoot,
      filePath: sessionIndexPath,
      location: {
        line: 1,
        byteOffset: 10,
      },
    },
    completeness: "complete",
    reason: "index",
    cursor: {
      provider: "codex",
      rootPath: codexRoot,
      filePath: sessionIndexPath,
      byteOffset: 10,
      line: 1,
    },
  };
}

function createObservedEvent(
  event: ObservedAgentEvent["event"],
  location: ReturnType<typeof createEventLocation>,
): ObservedAgentEvent {
  return {
    kind: "event",
    event,
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: location.discoveryPhase,
      rootPath: fixtureCodexRoot,
      filePath: fixtureTranscriptPath,
      location: {
        line: location.line,
        byteOffset: location.byteOffset,
      },
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
    observedSession: {
      provider: "codex",
      sessionId: fixtureSessionId,
      state: "canonical",
    },
  };
}

function createEventLocation(
  line: number,
  byteOffset: number,
  discoveryPhase: FixtureDiscoveryPhase,
) {
  return {
    line,
    byteOffset,
    discoveryPhase,
  };
}

function createWarning(
  code: IngestWarning["code"],
  options: {
    discoveryPhase: FixtureDiscoveryPhase;
  },
): IngestWarning {
  return {
    code,
    message: `${code} warning`,
    provider: "codex",
    filePath: fixtureTranscriptPath,
    source: {
      provider: "codex",
      kind: "transcript",
      discoveryPhase: options.discoveryPhase,
      rootPath: fixtureCodexRoot,
      filePath: fixtureTranscriptPath,
    },
  };
}

function createDiscoveryEvent(codexRoot: string): DiscoveryEvent {
  return {
    type: "scan.completed",
    provider: "codex",
    rootPath: codexRoot,
    discoveryPhase: "initial_scan",
  };
}

function createCursorKey() {
  return {
    provider: "codex" as const,
    rootPath: fixtureCodexRoot,
    filePath: fixtureTranscriptPath,
  };
}

function requireCursor(event: ObservedAgentEvent): IngestCursor {
  if (!event.cursor) {
    throw new Error("Expected observed event cursor in contract fixture.");
  }

  return event.cursor;
}
