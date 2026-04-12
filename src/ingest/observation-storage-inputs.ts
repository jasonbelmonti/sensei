import type {
  ObservedAgentEvent,
  ObservedEventSourceKind,
  ObservedSessionIdentity,
  ObservedSessionRecord,
} from "@jasonbelmonti/claudex/ingest";

import type {
  StoreCursorInput,
  StoreSessionInput,
  StorageSessionObservationReason,
} from "../storage";

type ObservedCursor =
  | ObservedAgentEvent["cursor"]
  | ObservedSessionRecord["cursor"];

type SessionWriteParams = {
  observedSession: ObservedSessionIdentity;
  source: ObservedAgentEvent["source"] | ObservedSessionRecord["source"];
  completeness:
    | ObservedAgentEvent["completeness"]
    | ObservedSessionRecord["completeness"];
  observationReason: StorageSessionObservationReason;
  observedAt?: string;
};

export function createObservedSessionStorageInput(
  params: SessionWriteParams,
): StoreSessionInput {
  return {
    provider: params.observedSession.provider,
    sessionId: params.observedSession.sessionId,
    identityState: params.observedSession.state,
    workingDirectory: params.observedSession.workingDirectory,
    metadata: params.observedSession.metadata,
    source: params.source,
    completeness: params.completeness,
    observationReason: params.observationReason,
    observedAt: params.observedAt,
  };
}

export function mapObservedCursorToStorageInput(
  cursor: ObservedCursor,
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

export function deriveObservationReasonFromSourceKind(
  kind: ObservedEventSourceKind,
): StorageSessionObservationReason {
  switch (kind) {
    case "snapshot":
      return "snapshot";
    case "session-index":
      return "index";
    case "transcript":
      return "transcript";
  }
}
