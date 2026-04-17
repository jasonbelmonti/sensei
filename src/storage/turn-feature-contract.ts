export const TURN_FEATURE_TABLE_NAME = "turn_features";
export const TURN_FEATURE_PRIMARY_KEY_COLUMNS = [
  "provider",
  "session_id",
  "turn_id",
  "feature_version",
] as const;
export const TURN_FEATURE_TYPED_COLUMNS = [
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
] as const;
export const TURN_FEATURE_JSON_COLUMNS = [
  "detail_json",
  "evidence_json",
] as const;
export const TURN_FEATURE_INDEXES = [
  {
    name: "turn_features_session_version_turn_sequence_idx",
    columns: ["provider", "session_id", "feature_version", "turn_sequence"],
  },
  {
    name: "turn_features_provider_version_status_idx",
    columns: ["provider", "feature_version", "turn_status"],
  },
] as const;

export const TURN_FEATURE_STORAGE_CONTRACT = {
  tableName: TURN_FEATURE_TABLE_NAME,
  primaryKeyColumns: TURN_FEATURE_PRIMARY_KEY_COLUMNS,
  typedColumns: TURN_FEATURE_TYPED_COLUMNS,
  jsonColumns: TURN_FEATURE_JSON_COLUMNS,
  indexes: TURN_FEATURE_INDEXES,
} as const;
