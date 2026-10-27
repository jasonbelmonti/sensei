import type { SenseiStorage } from "../../src/storage/index.js";

const tables = [
  "sessions",
  "turns",
  "turn_usage",
  "tool_events",
  "ingest_warnings",
] as const;

/** Explicit normalization of generated timestamps and the disposable fixture root. */
export function canonicalIngestRows(
  storage: Pick<SenseiStorage, "database">,
  root: string,
) {
  return Object.fromEntries(
    tables.map((table) => {
      const rows = storage.database
        .query(`SELECT * FROM ${table}`)
        .all() as Record<string, unknown>[];
      const normalized = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => {
            if (key === "updated_at" || key === "detected_at")
              return [key, "<generated-time>"];
            if (
              key === "observed_at" &&
              typeof value === "string" &&
              !value.startsWith("2026-10-01T")
            ) {
              return [key, "<generated-time>"];
            }
            const relocated =
              typeof value === "string"
                ? value.replaceAll(root, "<fixture>")
                : value;
            return [
              key,
              key.endsWith("_json") && typeof relocated === "string"
                ? JSON.parse(relocated)
                : relocated,
            ];
          }),
        ),
      );
      return [
        table,
        normalized.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        ),
      ];
    }),
  );
}
