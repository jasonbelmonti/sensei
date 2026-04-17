import { expect, test } from "bun:test";

import { TURN_FEATURE_STORAGE_CONTRACT } from "../../src/storage";

test("turn feature storage contract uses typed core columns plus json detail and evidence", () => {
  expect(TURN_FEATURE_STORAGE_CONTRACT).toEqual({
    tableName: "turn_features",
    primaryKeyColumns: [
      "provider",
      "session_id",
      "turn_id",
      "feature_version",
    ],
    typedColumns: [
      "provider",
      "session_id",
      "turn_id",
      "feature_version",
      "analyzed_at",
      "turn_sequence",
      "turn_status",
      "prompt_character_count",
      "attachment_count",
      "tool_call_count",
      "has_structured_output",
      "has_error",
      "input_tokens",
      "output_tokens",
      "cached_input_tokens",
      "cost_usd",
    ],
    jsonColumns: ["detail_json", "evidence_json"],
    indexes: [
      {
        name: "turn_features_session_version_turn_sequence_idx",
        columns: ["provider", "session_id", "feature_version", "turn_sequence"],
      },
      {
        name: "turn_features_provider_version_status_idx",
        columns: ["provider", "feature_version", "turn_status"],
      },
    ],
  });
});
