import type { StoreSessionInput } from "../storage";
import { mapPassiveScanRecordToStorageWrites } from "./record-mapper";
import type { SenseiPassiveScanRecord } from "./scan-result";

export function collectExplicitSessionWrites(
  records: readonly SenseiPassiveScanRecord[],
): Map<string, StoreSessionInput> {
  const explicitSessionWrites = new Map<string, StoreSessionInput>();

  for (const record of records) {
    if (record.kind !== "session") {
      continue;
    }

    const sessionWrite = mapPassiveScanRecordToStorageWrites(record).session;

    if (!sessionWrite) {
      continue;
    }

    const key = getSessionKey(sessionWrite.provider, sessionWrite.sessionId);
    const existingSessionWrite = explicitSessionWrites.get(key);

    explicitSessionWrites.set(
      key,
      existingSessionWrite
        ? chooseAuthoritativeExplicitSessionWrite(
            existingSessionWrite,
            sessionWrite,
          )
        : sessionWrite,
    );
  }

  return explicitSessionWrites;
}

export function resolveSessionWrite(
  sessionWrite: StoreSessionInput | undefined,
  explicitSessionWrites: ReadonlyMap<string, StoreSessionInput>,
): StoreSessionInput | undefined {
  if (!sessionWrite) {
    return undefined;
  }

  const explicitSessionWrite = explicitSessionWrites.get(
    getSessionKey(sessionWrite.provider, sessionWrite.sessionId),
  );

  if (!explicitSessionWrite) {
    return sessionWrite;
  }

  if (compareSessionStrength(explicitSessionWrite, sessionWrite) < 0) {
    return sessionWrite;
  }

  return {
    ...explicitSessionWrite,
    observedAt: explicitSessionWrite.observedAt ?? sessionWrite.observedAt,
  };
}

function chooseAuthoritativeExplicitSessionWrite(
  existing: StoreSessionInput,
  incoming: StoreSessionInput,
): StoreSessionInput {
  const comparison = compareExplicitSessionWrites(existing, incoming);
  const preferred = comparison >= 0 ? existing : incoming;
  const other = comparison >= 0 ? incoming : existing;

  return {
    ...preferred,
    observedAt: pickEarlierTimestamp(preferred.observedAt, other.observedAt),
  };
}

function compareExplicitSessionWrites(
  existing: StoreSessionInput,
  incoming: StoreSessionInput,
): number {
  return (
    compareSessionStrength(existing, incoming)
    || compareNumbers(
      sessionObservationReasonRank(existing.observationReason),
      sessionObservationReasonRank(incoming.observationReason),
    )
    || compareNumbers(
      sessionSourceKindRank(existing.source.kind),
      sessionSourceKindRank(incoming.source.kind),
    )
    || compareStrings(
      getSessionSourceIdentity(existing),
      getSessionSourceIdentity(incoming),
    )
  );
}

function compareSessionStrength(
  existing: StoreSessionInput,
  incoming: StoreSessionInput,
): number {
  return (
    compareNumbers(
      sessionIdentityRank(existing.identityState),
      sessionIdentityRank(incoming.identityState),
    )
    || compareNumbers(
      sessionCompletenessRank(existing.completeness),
      sessionCompletenessRank(incoming.completeness),
    )
  );
}

function sessionIdentityRank(
  identityState: StoreSessionInput["identityState"],
): number {
  switch (identityState) {
    case "canonical":
      return 1;
    case "provisional":
      return 0;
  }
}

function sessionCompletenessRank(
  completeness: StoreSessionInput["completeness"],
): number {
  switch (completeness) {
    case "complete":
      return 2;
    case "partial":
      return 1;
    case "best-effort":
      return 0;
  }
}

function sessionObservationReasonRank(
  observationReason: StoreSessionInput["observationReason"],
): number {
  switch (observationReason) {
    case "index":
      return 4;
    case "snapshot":
      return 3;
    case "reconcile":
      return 2;
    case "bootstrap":
      return 1;
    case "transcript":
      return 0;
  }
}

function sessionSourceKindRank(
  kind: StoreSessionInput["source"]["kind"],
): number {
  switch (kind) {
    case "session-index":
      return 2;
    case "snapshot":
      return 1;
    case "transcript":
      return 0;
  }
}

function getSessionSourceIdentity(sessionWrite: StoreSessionInput): string {
  return [
    sessionWrite.source.provider,
    sessionWrite.source.kind,
    sessionWrite.source.discoveryPhase,
    sessionWrite.source.rootPath,
    sessionWrite.source.filePath,
  ].join(":");
}

function pickEarlierTimestamp(
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (!existing) {
    return incoming;
  }

  if (!incoming) {
    return existing;
  }

  return existing <= incoming ? existing : incoming;
}

function compareNumbers(existing: number, incoming: number): number {
  return existing - incoming;
}

function compareStrings(existing: string, incoming: string): number {
  if (existing === incoming) {
    return 0;
  }

  return existing < incoming ? 1 : -1;
}

function getSessionKey(provider: string, sessionId: string): string {
  return `${provider}:${sessionId}`;
}
