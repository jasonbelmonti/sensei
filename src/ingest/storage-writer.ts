import type { SenseiStorage } from "../storage";
import {
  mapPassiveScanRecordToStorageWrites,
  mapPassiveScanWarningToStorageInput,
} from "./record-mapper";
import type { SenseiPassiveScanResult } from "./scan-result";
import {
  collectExplicitSessionWrites,
  resolveSessionWrite,
} from "./session-write-selection";

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
