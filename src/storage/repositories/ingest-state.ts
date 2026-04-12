import type { Database } from "bun:sqlite";

import type {
  StoreCursorInput,
  StoreWarningInput,
} from "../schema";
import {
  mapCursorRow,
  mapWarningRow,
  type CursorRow,
  type WarningRow,
} from "./ingest-state-records";
import { nowIsoString, serializeJson } from "./shared";

export type IngestStateRepository = ReturnType<typeof createIngestStateRepository>;

export function createIngestStateRepository(database: Database) {
  const cursorRowProjection = `
    provider,
    root_path as rootPath,
    file_path as filePath,
    byte_offset as byteOffset,
    line,
    fingerprint,
    continuity_token as continuityToken,
    metadata_json as metadataJson,
    updated_at as updatedAt
  `;
  const shouldAdvanceCursorExpression = `
    excluded.byte_offset > ingest_cursors.byte_offset
    OR (
      excluded.byte_offset = ingest_cursors.byte_offset
      AND excluded.line >= ingest_cursors.line
    )
  `;
  const selectCursorStatement = database.query(`
    SELECT
      ${cursorRowProjection}
    FROM ingest_cursors
    WHERE provider = ? AND root_path = ? AND file_path = ?
  `);
  const upsertCursorStatement = database.query(`
    INSERT INTO ingest_cursors (
      provider,
      root_path,
      file_path,
      byte_offset,
      line,
      fingerprint,
      continuity_token,
      metadata_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, root_path, file_path) DO UPDATE SET
      byte_offset = CASE
        WHEN ${shouldAdvanceCursorExpression}
          THEN excluded.byte_offset
        ELSE ingest_cursors.byte_offset
      END,
      line = CASE
        WHEN ${shouldAdvanceCursorExpression}
          THEN excluded.line
        ELSE ingest_cursors.line
      END,
      fingerprint = CASE
        WHEN ${shouldAdvanceCursorExpression}
          THEN COALESCE(excluded.fingerprint, ingest_cursors.fingerprint)
        ELSE ingest_cursors.fingerprint
      END,
      continuity_token = CASE
        WHEN ${shouldAdvanceCursorExpression}
          THEN COALESCE(excluded.continuity_token, ingest_cursors.continuity_token)
        ELSE ingest_cursors.continuity_token
      END,
      metadata_json = CASE
        WHEN ${shouldAdvanceCursorExpression}
          THEN COALESCE(excluded.metadata_json, ingest_cursors.metadata_json)
        ELSE ingest_cursors.metadata_json
      END,
      updated_at = CASE
        WHEN ${shouldAdvanceCursorExpression}
          THEN excluded.updated_at
        ELSE ingest_cursors.updated_at
      END
    RETURNING
      ${cursorRowProjection}
  `);
  const deleteCursorStatement = database.query(`
    DELETE FROM ingest_cursors
    WHERE provider = ? AND root_path = ? AND file_path = ?
  `);
  const insertWarningStatement = database.query(`
    INSERT INTO ingest_warnings (
      code,
      message,
      provider,
      file_path,
      source_provider,
      source_kind,
      source_discovery_phase,
      source_root_path,
      source_file_path,
      source_line,
      source_byte_offset,
      source_metadata_json,
      cause_json,
      raw_json,
      detected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING
      id,
      code,
      message,
      provider,
      file_path as filePath,
      source_provider as sourceProvider,
      source_kind as sourceKind,
      source_discovery_phase as sourceDiscoveryPhase,
      source_root_path as sourceRootPath,
      source_file_path as sourceFilePath,
      source_line as sourceLine,
      source_byte_offset as sourceByteOffset,
      source_metadata_json as sourceMetadataJson,
      cause_json as causeJson,
      raw_json as rawJson,
      detected_at as detectedAt
  `);
  const listWarningsStatement = database.query(`
    SELECT
      id,
      code,
      message,
      provider,
      file_path as filePath,
      source_provider as sourceProvider,
      source_kind as sourceKind,
      source_discovery_phase as sourceDiscoveryPhase,
      source_root_path as sourceRootPath,
      source_file_path as sourceFilePath,
      source_line as sourceLine,
      source_byte_offset as sourceByteOffset,
      source_metadata_json as sourceMetadataJson,
      cause_json as causeJson,
      raw_json as rawJson,
      detected_at as detectedAt
    FROM ingest_warnings
    ORDER BY id
  `);

  function getCursor(
    provider: StoreCursorInput["provider"],
    rootPath: string,
    filePath: string,
  ) {
    const row = selectCursorStatement.get(
      provider,
      rootPath,
      filePath,
    ) as CursorRow | null;
    return row ? mapCursorRow(row) : null;
  }

  function cursorUpsertParams(input: StoreCursorInput) {
    return [
      input.provider,
      input.rootPath,
      input.filePath,
      input.byteOffset,
      input.line,
      input.fingerprint ?? null,
      input.continuityToken ?? null,
      serializeJson(input.metadata),
      input.updatedAt ?? nowIsoString(),
    ] as const;
  }

  return {
    getCursor,
    setCursor(input: StoreCursorInput) {
      const row = upsertCursorStatement.get(
        ...cursorUpsertParams(input),
      ) as CursorRow | null;

      if (row === null) {
        throw new Error("Cursor write succeeded but no row was returned.");
      }

      return mapCursorRow(row);
    },
    deleteCursor(
      provider: StoreCursorInput["provider"],
      rootPath: string,
      filePath: string,
    ) {
      deleteCursorStatement.run(provider, rootPath, filePath);
    },
    recordWarning(input: StoreWarningInput) {
      const row = insertWarningStatement.get(
        input.code,
        input.message,
        input.provider ?? null,
        input.filePath ?? null,
        input.source?.provider ?? null,
        input.source?.kind ?? null,
        input.source?.discoveryPhase ?? null,
        input.source?.rootPath ?? null,
        input.source?.filePath ?? null,
        input.source?.location?.line ?? null,
        input.source?.location?.byteOffset ?? null,
        serializeJson(input.source?.metadata),
        serializeJson(input.cause),
        serializeJson(input.raw),
        input.detectedAt ?? nowIsoString(),
      ) as WarningRow;

      return mapWarningRow(row);
    },
    listWarnings() {
      return (listWarningsStatement.all() as WarningRow[]).map(mapWarningRow);
    },
  };
}
