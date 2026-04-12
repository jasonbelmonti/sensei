import type {
  IngestWarning,
  ObservedSessionRecord,
} from "@jasonbelmonti/claudex/ingest";

import type {
  StoreCursorInput,
  StoreSessionInput,
  StoreWarningInput,
} from "../storage";
import { mapObservedAgentEventToStorageWrites } from "./event-record-mapper";
import type { PassiveScanRecordStorageWrites } from "./record-storage-writes";
import type { SenseiPassiveScanRecord } from "./scan-result";

export type { PassiveScanRecordStorageWrites } from "./record-storage-writes";

export function mapPassiveScanRecordToStorageWrites(
  record: SenseiPassiveScanRecord,
): PassiveScanRecordStorageWrites {
  if (record.kind === "session") {
    return mapObservedSessionRecord(record.observedSession);
  }

  return mapObservedAgentEventToStorageWrites(record.observedEvent);
}

export function mapPassiveScanWarningToStorageInput(
  warning: IngestWarning,
): StoreWarningInput {
  return {
    code: warning.code,
    message: warning.message,
    provider: warning.provider,
    filePath: warning.filePath,
    source: warning.source,
    cause: warning.cause,
    raw: warning.raw,
  };
}

function mapObservedSessionRecord(
  record: ObservedSessionRecord,
): PassiveScanRecordStorageWrites {
  return {
    session: createSessionWrite(record),
    cursor: mapCursor(record.cursor),
  };
}

function createSessionWrite(record: ObservedSessionRecord): StoreSessionInput {
  return {
    provider: record.observedSession.provider,
    sessionId: record.observedSession.sessionId,
    identityState: record.observedSession.state,
    workingDirectory: record.observedSession.workingDirectory,
    metadata: record.observedSession.metadata,
    source: record.source,
    completeness: record.completeness,
    observationReason: record.reason,
  };
}

function mapCursor(
  cursor: ObservedSessionRecord["cursor"],
): StoreCursorInput | undefined {
  if (!cursor) {
    return undefined;
  }

  return {
    provider: cursor.provider,
    rootPath: cursor.rootPath,
    filePath: cursor.filePath,
    byteOffset: cursor.byteOffset,
    line: cursor.line,
    fingerprint: cursor.fingerprint,
    continuityToken: cursor.continuityToken,
    metadata: cursor.metadata,
    updatedAt: cursor.updatedAt,
  };
}
