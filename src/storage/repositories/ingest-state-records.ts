import type {
  StoredCursorRecord,
  StoredWarningRecord,
} from "../schema";
import {
  parseJson,
  parseJsonRecord,
  serializeJson,
  toOptionalLocation,
} from "./shared";

export type CursorRow = {
  provider: string;
  rootPath: string;
  filePath: string;
  byteOffset: number;
  line: number;
  fingerprint: string | null;
  continuityToken: string | null;
  metadataJson: string | null;
  updatedAt: string;
};

export type WarningRow = {
  id: number;
  code: string;
  message: string;
  provider: string | null;
  filePath: string | null;
  sourceProvider: string | null;
  sourceKind: string | null;
  sourceDiscoveryPhase: string | null;
  sourceRootPath: string | null;
  sourceFilePath: string | null;
  sourceLine: number | null;
  sourceByteOffset: number | null;
  sourceMetadataJson: string | null;
  causeJson: string | null;
  rawJson: string | null;
  detectedAt: string;
};

export function mapCursorRow(row: CursorRow): StoredCursorRecord {
  return {
    provider: row.provider as StoredCursorRecord["provider"],
    rootPath: row.rootPath,
    filePath: row.filePath,
    byteOffset: row.byteOffset,
    line: row.line,
    fingerprint: row.fingerprint ?? undefined,
    continuityToken: row.continuityToken ?? undefined,
    metadata: parseJsonRecord(row.metadataJson),
    updatedAt: row.updatedAt,
  };
}

export function mapWarningRow(row: WarningRow): StoredWarningRecord {
  const source =
    row.sourceProvider === null ||
    row.sourceKind === null ||
    row.sourceDiscoveryPhase === null ||
    row.sourceRootPath === null ||
    row.sourceFilePath === null
      ? undefined
      : {
          provider:
            row.sourceProvider as NonNullable<StoredWarningRecord["source"]>["provider"],
          kind: row.sourceKind as NonNullable<StoredWarningRecord["source"]>["kind"],
          discoveryPhase:
            row.sourceDiscoveryPhase as NonNullable<StoredWarningRecord["source"]>["discoveryPhase"],
          rootPath: row.sourceRootPath,
          filePath: row.sourceFilePath,
          location: toOptionalLocation(row.sourceLine, row.sourceByteOffset),
          metadata: parseJsonRecord(row.sourceMetadataJson),
        };

  return {
    id: row.id,
    code: row.code as StoredWarningRecord["code"],
    message: row.message,
    provider:
      row.provider === null
        ? undefined
        : (row.provider as StoredWarningRecord["provider"]),
    filePath: row.filePath ?? undefined,
    source,
    cause: parseJson(row.causeJson),
    raw: parseJson(row.rawJson),
    detectedAt: row.detectedAt,
  };
}

export function cursorStatementParams(record: StoredCursorRecord) {
  return [
    record.provider,
    record.rootPath,
    record.filePath,
    record.byteOffset,
    record.line,
    record.fingerprint ?? null,
    record.continuityToken ?? null,
    serializeJson(record.metadata),
    record.updatedAt,
  ] as const;
}
