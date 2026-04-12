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
      repositories.conversations.upsertSession(writes.session);
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

function persistWarning(
  storage: SenseiIngestWatchStorage,
  warning: IngestWarning,
): void {
  storage.ingestState.recordWarning(
    mapPassiveScanWarningToStorageInput(warning),
  );
}
