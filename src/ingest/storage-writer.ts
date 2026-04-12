import type { StoreSessionInput, SenseiStorage } from "../storage";
import { mapPassiveScanRecordToStorageWrites, mapPassiveScanWarningToStorageInput } from "./record-mapper";
import type { SenseiPassiveScanRecord } from "./scan-result";
import type { SenseiPassiveScanResult } from "./scan-result";

export type PassiveScanWriteSummary = {
  processedRecords: number;
  sessionWrites: number;
  turnWrites: number;
  turnUsageWrites: number;
  toolEventWrites: number;
  cursorWrites: number;
  warningWrites: number;
};

export function writePassiveScanResultToStorage(
  storage: Pick<SenseiStorage, "transaction">,
  result: SenseiPassiveScanResult,
): PassiveScanWriteSummary {
  const explicitSessionWrites = collectExplicitSessionWrites(result.records);

  return storage.transaction((repositories) => {
    const summary: PassiveScanWriteSummary = {
      processedRecords: 0,
      sessionWrites: 0,
      turnWrites: 0,
      turnUsageWrites: 0,
      toolEventWrites: 0,
      cursorWrites: 0,
      warningWrites: 0,
    };

    for (const record of result.records) {
      summary.processedRecords += 1;
      const writes = mapPassiveScanRecordToStorageWrites(record);
      const sessionWrite = resolveSessionWrite(
        writes.session,
        explicitSessionWrites,
      );

      if (sessionWrite) {
        repositories.conversations.upsertSession(sessionWrite);
        summary.sessionWrites += 1;
      }

      if (writes.prerequisiteTurn) {
        repositories.conversations.upsertTurn(writes.prerequisiteTurn);
        summary.turnWrites += 1;
      }

      if (writes.turn) {
        repositories.conversations.upsertTurn(writes.turn);
        summary.turnWrites += 1;
      }

      if (writes.turnUsage) {
        repositories.conversations.upsertTurnUsage(writes.turnUsage);
        summary.turnUsageWrites += 1;
      }

      if (writes.toolEvent) {
        repositories.conversations.upsertToolEvent(writes.toolEvent);
        summary.toolEventWrites += 1;
      }

      if (writes.cursor) {
        repositories.ingestState.setCursor(writes.cursor);
        summary.cursorWrites += 1;
      }
    }

    for (const warning of result.warnings) {
      repositories.ingestState.recordWarning(
        mapPassiveScanWarningToStorageInput(warning),
      );
      summary.warningWrites += 1;
    }

    return summary;
  });
}

function collectExplicitSessionWrites(
  records: readonly SenseiPassiveScanRecord[],
): Map<string, StoreSessionInput> {
  const explicitSessionWrites = new Map<string, StoreSessionInput>();

  for (const record of records) {
    if (record.kind !== "session") {
      continue;
    }

    const writes = mapPassiveScanRecordToStorageWrites(record);

    if (!writes.session) {
      continue;
    }

    const key = getSessionKey(writes.session.provider, writes.session.sessionId);
    const existingSessionWrite = explicitSessionWrites.get(key);

    explicitSessionWrites.set(
      key,
      existingSessionWrite
        ? chooseAuthoritativeExplicitSessionWrite(
            existingSessionWrite,
            writes.session,
          )
        : writes.session,
    );
  }

  return explicitSessionWrites;
}

function resolveSessionWrite(
  sessionWrite: StoreSessionInput | undefined,
  explicitSessionWrites: Map<string, StoreSessionInput>,
): StoreSessionInput | undefined {
  if (!sessionWrite) {
    return sessionWrite;
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
