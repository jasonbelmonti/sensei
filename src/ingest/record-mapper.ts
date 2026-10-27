import type {
  IngestWarning,
  ObservedSessionRecord,
} from "@jasonbelmonti/claudex/ingest";

import type { StoreWarningInput } from "../storage/index.js";
import { mapObservedAgentEventToStorageWrites } from "./event-record-mapper.js";
import {
  createObservedSessionStorageInput,
  mapObservedCursorToStorageInput,
} from "./observation-storage-inputs.js";
import type { PassiveScanRecordStorageWrites } from "./record-storage-writes.js";
import type { SenseiPassiveScanRecord } from "./scan-result.js";
import { toStorageProvider, toStorageSource } from "./storage-provider.js";

export type { PassiveScanRecordStorageWrites } from "./record-storage-writes.js";

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
    provider: warning.provider === undefined ? undefined : toStorageProvider(warning.provider),
    filePath: warning.filePath,
    source: warning.source === undefined ? undefined : toStorageSource(warning.source),
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
