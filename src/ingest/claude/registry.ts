// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.

import type { IngestProviderRegistry } from "../contracts.js";
import { createClaudeSnapshotTaskIngestRegistry } from "./snapshot-task-parser.js";
import { createClaudeTranscriptIngestRegistry } from "./transcript-parser.js";

export {
  createClaudeSnapshotTaskIngestRegistry,
  createClaudeTranscriptIngestRegistry,
};

export function createClaudeIngestRegistries(): IngestProviderRegistry[] {
  return [
    createClaudeSnapshotTaskIngestRegistry(),
    createClaudeTranscriptIngestRegistry(),
  ];
}
