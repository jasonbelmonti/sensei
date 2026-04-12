import type {
  IngestWarning,
  ObservedSessionRecord,
} from "@jasonbelmonti/claudex/ingest";

import type { StoreWarningInput } from "../storage";
import { mapObservedAgentEventToStorageWrites } from "./event-record-mapper";
import {
  createObservedSessionStorageInput,
  mapObservedCursorToStorageInput,
} from "./observation-storage-inputs";
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
    session: createObservedSessionStorageInput({
      observedSession: record.observedSession,
      source: record.source,
      completeness: record.completeness,
      observationReason: record.reason,
    }),
    cursor: mapObservedCursorToStorageInput(record.cursor),
  };
}
