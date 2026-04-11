import type {
  StoreCursorInput,
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

export function mergeCursorRecord(
  existing: StoredCursorRecord | null,
  incoming: StoreCursorInput & { updatedAt: string },
): StoredCursorRecord {
  if (existing === null) {
    return incoming;
  }

  if (compareCursorProgress(incoming, existing) < 0) {
    return existing;
  }

  return {
    provider: incoming.provider,
    rootPath: incoming.rootPath,
    filePath: incoming.filePath,
    byteOffset: incoming.byteOffset,
    line: incoming.line,
    fingerprint: incoming.fingerprint ?? existing.fingerprint,
    continuityToken: incoming.continuityToken ?? existing.continuityToken,
    metadata: incoming.metadata ?? existing.metadata,
    updatedAt: incoming.updatedAt,
  };
}

function compareCursorProgress(
  left: Pick<StoredCursorRecord, "byteOffset" | "line">,
  right: Pick<StoredCursorRecord, "byteOffset" | "line">,
): number {
  if (left.byteOffset !== right.byteOffset) {
    return left.byteOffset - right.byteOffset;
  }

  return left.line - right.line;
}
