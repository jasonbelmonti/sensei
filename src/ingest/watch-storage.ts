import type {
  CursorStore,
  IngestWarning,
  ObservedAgentEvent,
  ObservedSessionRecord,
  SessionIngestServiceOptions,
} from "@jasonbelmonti/claudex/ingest";

import type { SenseiStorage } from "../storage";
import {
  mapPassiveScanRecordToStorageWrites,
  mapPassiveScanWarningToStorageInput,
} from "./record-mapper";
import { selectAuthoritativeExplicitSessionWrite } from "./session-write-selection";

export type SenseiIngestWatchStorage = Pick<
  SenseiStorage,
  "transaction" | "ingestState"
>;

export function createSenseiWatchStorageBindings(
  storage: SenseiIngestWatchStorage,
): Pick<
  SessionIngestServiceOptions,
  "cursorStore" | "onObservedEvent" | "onObservedSession" | "onWarning"
> {
  return {
    cursorStore: createSenseiStorageCursorStore(storage),
    onObservedEvent(observedEvent) {
      persistRecord(storage, {
        kind: "event",
        observedEvent,
      });
    },
    onObservedSession(observedSession) {
      persistRecord(storage, {
        kind: "session",
        observedSession,
      });
    },
    onWarning(warning) {
      persistWarning(storage, warning);
    },
  };
}

function createSenseiStorageCursorStore(
  storage: SenseiIngestWatchStorage,
): CursorStore {
  return {
    async get(key) {
      return (
        storage.ingestState.getCursor(
          key.provider,
          key.rootPath,
          key.filePath,
        ) ?? null
      );
    },
    async set(cursor) {
      storage.ingestState.setCursor(cursor);
    },
    async delete(key) {
      storage.ingestState.deleteCursor(
        key.provider,
        key.rootPath,
        key.filePath,
      );
    },
  };
}

function persistRecord(
  storage: SenseiIngestWatchStorage,
  record:
    | {
        kind: "event";
        observedEvent: ObservedAgentEvent;
      }
    | {
        kind: "session";
        observedSession: ObservedSessionRecord;
      },
): void {
  const writes = mapPassiveScanRecordToStorageWrites(record);

  storage.transaction((repositories) => {
    if (writes.session) {
      if (record.kind === "session") {
        repositories.conversations.upsertAuthoritativeSession(
          resolveWatchExplicitSessionWrite(
            repositories.conversations.getSession(
              writes.session.provider,
              writes.session.sessionId,
            ),
            writes.session,
          ),
        );
      } else {
        repositories.conversations.upsertSession(writes.session);
      }
    }

    if (writes.prerequisiteTurn) {
      repositories.conversations.upsertTurn(writes.prerequisiteTurn);
    }

    if (writes.turn) {
      repositories.conversations.upsertTurn(writes.turn);
    }

    if (writes.turnUsage) {
      repositories.conversations.upsertTurnUsage(writes.turnUsage);
    }

    if (writes.toolEvent) {
      repositories.conversations.upsertToolEvent(writes.toolEvent);
    }
  });
}

function resolveWatchExplicitSessionWrite(
  existingSession:
    | ReturnType<SenseiStorage["conversations"]["getSession"]>
    | null
    | undefined,
  incomingSession: Parameters<SenseiStorage["conversations"]["upsertSession"]>[0],
): Parameters<SenseiStorage["conversations"]["upsertSession"]>[0] {
  if (!existingSession) {
    return incomingSession;
  }

  return selectAuthoritativeExplicitSessionWrite(
    toSessionInput(existingSession),
    incomingSession,
  );
}

function toSessionInput(
  session: NonNullable<ReturnType<SenseiStorage["conversations"]["getSession"]>>,
): Parameters<SenseiStorage["conversations"]["upsertSession"]>[0] {
  return {
    provider: session.provider,
    sessionId: session.sessionId,
    identityState: session.identityState,
    workingDirectory: session.workingDirectory,
    metadata: session.metadata,
    source: session.source,
    completeness: session.completeness,
    observationReason: session.observationReason,
    observedAt: session.observedAt,
  };
}

function persistWarning(
  storage: SenseiIngestWatchStorage,
  warning: IngestWarning,
): void {
  storage.ingestState.recordWarning(
    mapPassiveScanWarningToStorageInput(warning),
  );
}
