import type { SenseiCliCommandDefinition } from "./types";

export const senseiCommandGroups = [
  {
    name: "ingest",
    summary: "Backfill or observe local Claude and Codex history.",
  },
  {
    name: "analyze",
    summary: "Run deterministic feature extraction and mentoring analysis.",
  },
  {
    name: "report",
    summary: "Render operator-facing summaries over stored insights.",
  },
  {
    name: "draft",
    summary: "Prepare reviewable draft skills, scripts, and automations.",
  },
] as const satisfies ReadonlyArray<SenseiCliCommandDefinition>;
