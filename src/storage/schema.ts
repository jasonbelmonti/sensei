export const STORAGE_PROVIDER_IDS = ["claude", "codex"] as const;

export type StorageProviderId = (typeof STORAGE_PROVIDER_IDS)[number];

export const STORAGE_SOURCE_KINDS = [
  "transcript",
  "snapshot",
  "session-index",
] as const;

export type StorageSourceKind = (typeof STORAGE_SOURCE_KINDS)[number];

export const STORAGE_DISCOVERY_PHASES = [
  "initial_scan",
  "watch",
  "reconcile",
] as const;

export type StorageDiscoveryPhase = (typeof STORAGE_DISCOVERY_PHASES)[number];

export const STORAGE_COMPLETENESS_VALUES = [
  "complete",
  "partial",
  "best-effort",
] as const;

export type StorageCompleteness = (typeof STORAGE_COMPLETENESS_VALUES)[number];

export const STORAGE_SESSION_IDENTITY_STATES = [
  "canonical",
  "provisional",
] as const;

export type StorageSessionIdentityState =
  (typeof STORAGE_SESSION_IDENTITY_STATES)[number];

export const STORAGE_SESSION_OBSERVATION_REASONS = [
  "bootstrap",
  "index",
  "snapshot",
  "transcript",
  "reconcile",
] as const;

export type StorageSessionObservationReason =
  (typeof STORAGE_SESSION_OBSERVATION_REASONS)[number];

export const STORAGE_TURN_STATUSES = [
  "started",
  "completed",
  "failed",
] as const;

export type StorageTurnStatus = (typeof STORAGE_TURN_STATUSES)[number];

export const STORAGE_TOOL_KINDS = ["command", "mcp", "custom", "unknown"] as const;

export type StorageToolKind = (typeof STORAGE_TOOL_KINDS)[number];

export const STORAGE_TOOL_EVENT_STATUSES = [
  "started",
  "updated",
  "completed",
] as const;

export type StorageToolEventStatus = (typeof STORAGE_TOOL_EVENT_STATUSES)[number];

export const STORAGE_TOOL_OUTCOMES = [
  "success",
  "error",
  "cancelled",
] as const;

export type StorageToolOutcome = (typeof STORAGE_TOOL_OUTCOMES)[number];

export const STORAGE_WARNING_CODES = [
  "watch-failed",
  "file-open-failed",
  "parse-failed",
  "unsupported-record",
  "duplicate-root",
  "cursor-reset",
  "truncated-file",
  "rotated-file",
] as const;

export type StorageWarningCode = (typeof STORAGE_WARNING_CODES)[number];

export type JsonRecord = Readonly<Record<string, unknown>>;

export type StorageEventLocation = {
  line?: number;
  byteOffset?: number;
};

export type StorageEventSource = {
  provider: StorageProviderId;
  kind: StorageSourceKind;
  discoveryPhase: StorageDiscoveryPhase;
  rootPath: string;
  filePath: string;
  location?: StorageEventLocation;
  metadata?: JsonRecord;
};

export type StorageSessionKey = {
  provider: StorageProviderId;
  sessionId: string;
};

export type StoredSessionRecord = StorageSessionKey & {
  identityState: StorageSessionIdentityState;
  workingDirectory?: string;
  metadata?: JsonRecord;
  source: StorageEventSource;
  completeness: StorageCompleteness;
  observationReason: StorageSessionObservationReason;
  observedAt: string;
  updatedAt: string;
};

export type StoreSessionInput = StorageSessionKey & {
  identityState: StorageSessionIdentityState;
  workingDirectory?: string;
  metadata?: JsonRecord;
  source: StorageEventSource;
  completeness: StorageCompleteness;
  observationReason: StorageSessionObservationReason;
  observedAt?: string;
};

export type StorageTurnKey = StorageSessionKey & {
  turnId: string;
};

export type StorageTurnInput = {
  prompt: string;
  attachments?: unknown[];
  metadata?: JsonRecord;
};

export type StorageTurnOutput = {
  text: string;
  structuredOutput?: unknown;
  stopReason?: string | null;
};

export type StorageTurnError = {
  code: string;
  message: string;
  details?: JsonRecord;
};

export type StoredTurnRecord = StorageTurnKey & {
  status: StorageTurnStatus;
  input?: StorageTurnInput;
  output?: StorageTurnOutput;
  error?: StorageTurnError;
  raw?: unknown;
  extensions?: JsonRecord;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  updatedAt: string;
};

export type StoreTurnInput = StorageTurnKey & {
  status: StorageTurnStatus;
  input?: StorageTurnInput;
  output?: StorageTurnOutput;
  error?: StorageTurnError;
  raw?: unknown;
  extensions?: JsonRecord;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
};

export type StoredTurnUsageRecord = StorageTurnKey & {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  costUsd?: number;
  providerUsage?: JsonRecord;
  updatedAt: string;
};

export type StoreTurnUsageInput = StorageTurnKey & {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  costUsd?: number;
  providerUsage?: JsonRecord;
};

export type StorageToolEventKey = StorageTurnKey & {
  toolCallId: string;
};

export type StoredToolEventRecord = StorageToolEventKey & {
  status: StorageToolEventStatus;
  toolName?: string;
  toolKind?: StorageToolKind;
  input?: unknown;
  output?: unknown;
  statusText?: string;
  outcome?: StorageToolOutcome;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export type StoreToolEventInput = StorageToolEventKey & {
  status: StorageToolEventStatus;
  toolName?: string;
  toolKind?: StorageToolKind;
  input?: unknown;
  output?: unknown;
  statusText?: string;
  outcome?: StorageToolOutcome;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

export type StorageCursorKey = {
  provider: StorageProviderId;
  rootPath: string;
  filePath: string;
};

export type StoredCursorRecord = StorageCursorKey & {
  byteOffset: number;
  line: number;
  fingerprint?: string;
  continuityToken?: string;
  metadata?: JsonRecord;
  updatedAt: string;
};

export type StoreCursorInput = StorageCursorKey & {
  byteOffset: number;
  line: number;
  fingerprint?: string;
  continuityToken?: string;
  metadata?: JsonRecord;
  updatedAt?: string;
};

export type StoredWarningRecord = {
  id: number;
  code: StorageWarningCode;
  message: string;
  provider?: StorageProviderId;
  filePath?: string;
  source?: StorageEventSource;
  cause?: unknown;
  raw?: unknown;
  detectedAt: string;
};

export type StoreWarningInput = {
  code: StorageWarningCode;
  message: string;
  provider?: StorageProviderId;
  filePath?: string;
  source?: StorageEventSource;
  cause?: unknown;
  raw?: unknown;
  detectedAt?: string;
};

const providerValues = quotedValues(STORAGE_PROVIDER_IDS);
const sourceKindValues = quotedValues(STORAGE_SOURCE_KINDS);
const discoveryPhaseValues = quotedValues(STORAGE_DISCOVERY_PHASES);
const completenessValues = quotedValues(STORAGE_COMPLETENESS_VALUES);
const sessionIdentityValues = quotedValues(STORAGE_SESSION_IDENTITY_STATES);
const observationReasonValues = quotedValues(STORAGE_SESSION_OBSERVATION_REASONS);
const turnStatusValues = quotedValues(STORAGE_TURN_STATUSES);
const toolKindValues = quotedValues(STORAGE_TOOL_KINDS);
const toolEventStatusValues = quotedValues(STORAGE_TOOL_EVENT_STATUSES);
const toolOutcomeValues = quotedValues(STORAGE_TOOL_OUTCOMES);
const warningCodeValues = quotedValues(STORAGE_WARNING_CODES);

export const STORAGE_MIGRATIONS = [
  {
    id: "0001_canonical_storage",
    statements: [
      `
        CREATE TABLE sessions (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          identity_state TEXT NOT NULL CHECK (identity_state IN (${sessionIdentityValues})),
          working_directory TEXT,
          session_metadata_json TEXT CHECK (session_metadata_json IS NULL OR json_valid(session_metadata_json)),
          source_kind TEXT NOT NULL CHECK (source_kind IN (${sourceKindValues})),
          discovery_phase TEXT NOT NULL CHECK (discovery_phase IN (${discoveryPhaseValues})),
          source_root_path TEXT NOT NULL,
          source_file_path TEXT NOT NULL,
          source_line INTEGER,
          source_byte_offset INTEGER,
          source_metadata_json TEXT CHECK (source_metadata_json IS NULL OR json_valid(source_metadata_json)),
          completeness TEXT NOT NULL CHECK (completeness IN (${completenessValues})),
          observation_reason TEXT NOT NULL CHECK (observation_reason IN (${observationReasonValues})),
          observed_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, session_id)
        );
      `,
      `
        CREATE INDEX sessions_source_file_path_idx
        ON sessions (source_file_path);
      `,
      `
        CREATE TABLE turns (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN (${turnStatusValues})),
          input_prompt TEXT,
          input_attachments_json TEXT CHECK (input_attachments_json IS NULL OR json_valid(input_attachments_json)),
          input_metadata_json TEXT CHECK (input_metadata_json IS NULL OR json_valid(input_metadata_json)),
          output_text TEXT,
          output_structured_output_json TEXT CHECK (output_structured_output_json IS NULL OR json_valid(output_structured_output_json)),
          stop_reason TEXT,
          error_code TEXT,
          error_message TEXT,
          error_details_json TEXT CHECK (error_details_json IS NULL OR json_valid(error_details_json)),
          raw_event_json TEXT CHECK (raw_event_json IS NULL OR json_valid(raw_event_json)),
          extensions_json TEXT CHECK (extensions_json IS NULL OR json_valid(extensions_json)),
          started_at TEXT,
          completed_at TEXT,
          failed_at TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, session_id, turn_id),
          FOREIGN KEY (provider, session_id)
            REFERENCES sessions(provider, session_id)
            ON DELETE CASCADE
        );
      `,
      `
        CREATE INDEX turns_session_updated_at_idx
        ON turns (provider, session_id, updated_at);
      `,
      `
        CREATE TABLE turn_usage (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          cached_input_tokens INTEGER,
          cost_usd REAL,
          provider_usage_json TEXT CHECK (provider_usage_json IS NULL OR json_valid(provider_usage_json)),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, session_id, turn_id),
          FOREIGN KEY (provider, session_id, turn_id)
            REFERENCES turns(provider, session_id, turn_id)
            ON DELETE CASCADE
        );
      `,
      `
        CREATE TABLE tool_events (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          tool_call_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN (${toolEventStatusValues})),
          tool_name TEXT,
          tool_kind TEXT CHECK (tool_kind IS NULL OR tool_kind IN (${toolKindValues})),
          input_json TEXT CHECK (input_json IS NULL OR json_valid(input_json)),
          output_json TEXT CHECK (output_json IS NULL OR json_valid(output_json)),
          status_text TEXT,
          outcome TEXT CHECK (outcome IS NULL OR outcome IN (${toolOutcomeValues})),
          error_message TEXT,
          started_at TEXT,
          completed_at TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, session_id, turn_id, tool_call_id),
          FOREIGN KEY (provider, session_id, turn_id)
            REFERENCES turns(provider, session_id, turn_id)
            ON DELETE CASCADE
        );
      `,
      `
        CREATE INDEX tool_events_turn_updated_at_idx
        ON tool_events (provider, session_id, turn_id, updated_at);
      `,
      `
        CREATE TABLE ingest_cursors (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          root_path TEXT NOT NULL,
          file_path TEXT NOT NULL,
          byte_offset INTEGER NOT NULL,
          line INTEGER NOT NULL,
          fingerprint TEXT,
          continuity_token TEXT,
          metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, root_path, file_path)
        );
      `,
      `
        CREATE TABLE ingest_warnings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL CHECK (code IN (${warningCodeValues})),
          message TEXT NOT NULL,
          provider TEXT CHECK (provider IS NULL OR provider IN (${providerValues})),
          file_path TEXT,
          source_provider TEXT CHECK (source_provider IS NULL OR source_provider IN (${providerValues})),
          source_kind TEXT CHECK (source_kind IS NULL OR source_kind IN (${sourceKindValues})),
          source_discovery_phase TEXT CHECK (source_discovery_phase IS NULL OR source_discovery_phase IN (${discoveryPhaseValues})),
          source_root_path TEXT,
          source_file_path TEXT,
          source_line INTEGER,
          source_byte_offset INTEGER,
          source_metadata_json TEXT CHECK (source_metadata_json IS NULL OR json_valid(source_metadata_json)),
          cause_json TEXT CHECK (cause_json IS NULL OR json_valid(cause_json)),
          raw_json TEXT CHECK (raw_json IS NULL OR json_valid(raw_json)),
          detected_at TEXT NOT NULL
        );
      `,
      `
        CREATE INDEX ingest_warnings_detected_at_idx
        ON ingest_warnings (detected_at);
      `,
      `
        CREATE INDEX ingest_warnings_provider_file_idx
        ON ingest_warnings (provider, file_path);
      `,
    ],
  },
] as const;

function quotedValues(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}
