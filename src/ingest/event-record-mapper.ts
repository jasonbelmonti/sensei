import type {
  ObservedAgentEvent,
  ObservedSessionIdentity,
} from "@jasonbelmonti/claudex/ingest";

import type {
  StoreCursorInput,
  StoreToolEventInput,
  StorageTurnKey,
  StoreTurnInput,
  StoreTurnUsageInput,
} from "../storage";
import {
  createObservedSessionStorageInput,
  deriveObservationReasonFromSourceKind,
  mapObservedCursorToStorageInput,
} from "./observation-storage-inputs";
import type { PassiveScanRecordStorageWrites } from "./record-storage-writes";

type PassiveEvent = ObservedAgentEvent["event"];
type PassiveTurnStartedEvent = Extract<PassiveEvent, { type: "turn.started" }>;
type PassiveTurnCompletedEvent = Extract<PassiveEvent, { type: "turn.completed" }>;
type PassiveTurnFailedEvent = Extract<PassiveEvent, { type: "turn.failed" }>;

export function mapObservedAgentEventToStorageWrites(
  record: ObservedAgentEvent,
): PassiveScanRecordStorageWrites {
  const session = record.observedSession
    ? createObservedSessionStorageInput({
        observedSession: record.observedSession,
        source: record.source,
        completeness: record.completeness,
        observationReason: deriveObservationReasonFromSourceKind(record.source.kind),
        observedAt: record.event.timestamp,
      })
    : undefined;
  const cursor = mapObservedCursorToStorageInput(record.cursor);

  switch (record.event.type) {
    case "turn.started":
      return {
        session,
        turn: mapTurnStarted(record.observedSession, record.event),
        cursor,
      };
    case "turn.completed":
      return {
        session,
        turn: mapTurnCompleted(record.observedSession, record.event),
        turnUsage: mapTurnUsage(record.observedSession, record.event),
        cursor,
      };
    case "turn.failed":
      return {
        session,
        turn: mapTurnFailed(record.observedSession, record.event),
        cursor,
      };
    case "tool.started":
      return mapToolEventRecord(
        session,
        cursor,
        mapToolStarted(record),
      );
    case "tool.updated":
      return mapToolEventRecord(
        session,
        cursor,
        mapToolUpdated(record),
      );
    case "tool.completed":
      return mapToolEventRecord(
        session,
        cursor,
        mapToolCompleted(record),
      );
    default:
      return {
        session,
        cursor,
      };
  }
}

function mapToolEventRecord(
  session: PassiveScanRecordStorageWrites["session"],
  cursor: StoreCursorInput | undefined,
  toolEvent: StoreToolEventInput | undefined,
): PassiveScanRecordStorageWrites {
  if (!toolEvent) {
    return {
      session,
      cursor,
    };
  }

  return {
    session,
    prerequisiteTurn: createPlaceholderTurn(toolEvent),
    toolEvent,
    cursor,
  };
}

function mapTurnStarted(
  observedSession: ObservedSessionIdentity | null,
  event: PassiveTurnStartedEvent,
): StoreTurnInput | undefined {
  const turnKey = createTurnKey(observedSession, event.turnId);

  if (!turnKey) {
    return undefined;
  }

  return {
    ...turnKey,
    status: "started",
    input: {
      prompt: event.input.prompt,
      attachments: event.input.attachments,
      metadata: event.input.metadata,
    },
    raw: event.raw,
    extensions: event.extensions,
    startedAt: event.timestamp,
  };
}

function mapTurnCompleted(
  observedSession: ObservedSessionIdentity | null,
  event: PassiveTurnCompletedEvent,
): StoreTurnInput | undefined {
  const turnKey = createTurnKey(
    observedSession,
    event.turnId ?? event.result.turnId,
  );

  if (!turnKey) {
    return undefined;
  }

  return {
    ...turnKey,
    status: "completed",
    output: {
      text: event.result.text,
      structuredOutput: event.result.structuredOutput,
      stopReason: event.result.stopReason,
    },
    raw: event.result.raw ?? event.raw,
    extensions: event.result.extensions ?? event.extensions,
    completedAt: event.timestamp,
  };
}

function mapTurnUsage(
  observedSession: ObservedSessionIdentity | null,
  event: PassiveTurnCompletedEvent,
): StoreTurnUsageInput | undefined {
  const usage = event.result.usage;
  const turnKey = createTurnKey(
    observedSession,
    event.turnId ?? event.result.turnId,
  );

  if (!turnKey || !usage) {
    return undefined;
  }

  return {
    ...turnKey,
    inputTokens: usage.tokens.input,
    outputTokens: usage.tokens.output,
    cachedInputTokens: usage.tokens.cachedInput,
    costUsd: usage.costUsd,
    providerUsage: usage.providerUsage,
  };
}

function mapTurnFailed(
  observedSession: ObservedSessionIdentity | null,
  event: PassiveTurnFailedEvent,
): StoreTurnInput | undefined {
  const turnKey = createTurnKey(observedSession, event.turnId);

  if (!turnKey) {
    return undefined;
  }

  return {
    ...turnKey,
    status: "failed",
    error: {
      code: event.error.code,
      message: event.error.message,
      details: event.error.details,
    },
    raw: event.error.raw ?? event.raw,
    extensions: event.error.extensions ?? event.extensions,
    failedAt: event.timestamp,
  };
}

function mapToolStarted(
  record: ObservedAgentEvent,
): StoreToolEventInput | undefined {
  const event = record.event;

  if (event.type !== "tool.started") {
    return undefined;
  }

  const turnKey = createTurnKey(record.observedSession, event.turnId);

  if (!turnKey) {
    return undefined;
  }

  return {
    ...turnKey,
    toolCallId: event.toolCallId,
    status: "started",
    toolName: event.toolName,
    toolKind: event.kind,
    input: event.input,
    startedAt: event.timestamp,
  };
}

function mapToolUpdated(
  record: ObservedAgentEvent,
): StoreToolEventInput | undefined {
  const event = record.event;

  if (event.type !== "tool.updated") {
    return undefined;
  }

  const turnKey = createTurnKey(record.observedSession, event.turnId);

  if (!turnKey) {
    return undefined;
  }

  return {
    ...turnKey,
    toolCallId: event.toolCallId,
    status: "updated",
    statusText: event.statusText,
    output: event.output,
  };
}

function mapToolCompleted(
  record: ObservedAgentEvent,
): StoreToolEventInput | undefined {
  const event = record.event;

  if (event.type !== "tool.completed") {
    return undefined;
  }

  const turnKey = createTurnKey(record.observedSession, event.turnId);

  if (!turnKey) {
    return undefined;
  }

  return {
    ...turnKey,
    toolCallId: event.toolCallId,
    status: "completed",
    toolName: event.toolName,
    toolKind: event.kind,
    output: event.output,
    outcome: event.outcome,
    errorMessage: event.errorMessage,
    completedAt: event.timestamp,
  };
}

function createPlaceholderTurn(
  toolEvent: StoreToolEventInput,
): StoreTurnInput {
  return {
    provider: toolEvent.provider,
    sessionId: toolEvent.sessionId,
    turnId: toolEvent.turnId,
    status: "started",
  };
}

function createTurnKey(
  observedSession: ObservedSessionIdentity | null,
  turnId: string | undefined,
): StorageTurnKey | undefined {
  if (!observedSession || !turnId) {
    return undefined;
  }

  return {
    provider: observedSession.provider,
    sessionId: observedSession.sessionId,
    turnId,
  };
}
