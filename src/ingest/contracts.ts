// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import type { AgentEvent, ProviderId } from "./event-contract.js";

export type { AgentEvent, ProviderId } from "./event-contract.js";

export type IngestCursorKey = {
  provider: ProviderId;
  rootPath: string;
  filePath: string;
};

export type IngestCursor = IngestCursorKey & {
  byteOffset: number;
  line: number;
  fingerprint?: string;
  continuityToken?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export interface CursorStore {
  get(key: IngestCursorKey): Promise<IngestCursor | null>;
  set(cursor: IngestCursor): Promise<void>;
  delete(key: IngestCursorKey): Promise<void>;
}

export const OBSERVED_EVENT_SOURCE_KINDS = [
  "transcript",
  "snapshot",
  "session-index",
] as const;

export type ObservedEventSourceKind =
  (typeof OBSERVED_EVENT_SOURCE_KINDS)[number];

export const DISCOVERY_PHASES = ["initial_scan", "watch", "reconcile"] as const;

export type DiscoveryPhase = (typeof DISCOVERY_PHASES)[number];

export type ObservedEventLocation = {
  line?: number;
  byteOffset?: number;
};

export type ObservedEventSource = {
  provider: ProviderId;
  kind: ObservedEventSourceKind;
  discoveryPhase: DiscoveryPhase;
  rootPath: string;
  filePath: string;
  location?: ObservedEventLocation;
  metadata?: Record<string, unknown>;
};

export const DISCOVERY_EVENT_TYPES = [
  "scan.started",
  "scan.completed",
  "watch.started",
  "watch.stopped",
  "reconcile.started",
  "reconcile.completed",
  "file.discovered",
  "file.changed",
  "file.deleted",
  "root.skipped",
] as const;

export type DiscoveryEventType = (typeof DISCOVERY_EVENT_TYPES)[number];

export type DiscoveryRootConfig = {
  provider: ProviderId;
  path: string;
  recursive?: boolean;
  watch?: boolean;
  metadata?: Record<string, unknown>;
};

export type DiscoveryEvent = {
  type: DiscoveryEventType;
  provider: ProviderId;
  rootPath: string;
  discoveryPhase: DiscoveryPhase;
  filePath?: string;
  detail?: string;
  raw?: unknown;
};

export const OBSERVED_SESSION_IDENTITY_STATES = [
  "canonical",
  "provisional",
] as const;

export type ObservedSessionIdentityState =
  (typeof OBSERVED_SESSION_IDENTITY_STATES)[number];

export type ObservedSessionIdentity = {
  provider: ProviderId;
  sessionId: string;
  state: ObservedSessionIdentityState;
  workingDirectory?: string;
  metadata?: Record<string, unknown>;
};

export const OBSERVED_EVENT_COMPLETENESS = [
  "complete",
  "partial",
  "best-effort",
] as const;

export type ObservedEventCompleteness =
  (typeof OBSERVED_EVENT_COMPLETENESS)[number];

export const INGEST_WARNING_CODES = [
  "watch-failed",
  "file-open-failed",
  "parse-failed",
  "unsupported-record",
  "duplicate-root",
  "cursor-reset",
  "truncated-file",
  "rotated-file",
] as const;

export type IngestWarningCode = (typeof INGEST_WARNING_CODES)[number];

export type IngestWarning = {
  code: IngestWarningCode;
  message: string;
  provider?: ProviderId;
  filePath?: string;
  source?: ObservedEventSource;
  cause?: unknown;
  raw?: unknown;
};

export type ObservedAgentEvent = {
  kind: "event";
  event: AgentEvent;
  source: ObservedEventSource;
  observedSession: ObservedSessionIdentity | null;
  completeness: ObservedEventCompleteness;
  cursor?: IngestCursor;
  warnings?: IngestWarning[];
};

export const OBSERVED_SESSION_REASONS = [
  "bootstrap",
  "index",
  "snapshot",
  "transcript",
  "reconcile",
] as const;

export type ObservedSessionReason = (typeof OBSERVED_SESSION_REASONS)[number];

export type ObservedSessionRecord = {
  kind: "session";
  observedSession: ObservedSessionIdentity;
  source: ObservedEventSource;
  completeness: ObservedEventCompleteness;
  reason: ObservedSessionReason;
  cursor?: IngestCursor;
  warnings?: IngestWarning[];
};

export type ObservedIngestRecord = ObservedAgentEvent | ObservedSessionRecord;

export type IngestFileMatch = {
  kind: ObservedEventSourceKind;
  metadata?: Record<string, unknown>;
};

export type IngestParseContext = {
  root: DiscoveryRootConfig;
  filePath: string;
  discoveryPhase: DiscoveryPhase;
  cursor: IngestCursor | null;
  match: IngestFileMatch;
  byteLength?: number;
  onIncompleteLine?: () => Promise<void>;
};

export interface IngestProviderRegistry {
  readonly provider: ProviderId;

  matchFile(
    filePath: string,
    root: DiscoveryRootConfig,
  ): IngestFileMatch | null;
  parseFile(
    context: IngestParseContext,
  ):
    | AsyncIterable<ObservedIngestRecord>
    | Promise<AsyncIterable<ObservedIngestRecord>>;
}

export type IngestRecordHandler = (
  record: ObservedIngestRecord,
) => Promise<void> | void;

export type ObservedEventHandler = (
  observedEvent: ObservedAgentEvent,
) => Promise<void> | void;

export type ObservedSessionHandler = (
  observedSession: ObservedSessionRecord,
) => Promise<void> | void;

export type IngestWarningHandler = (
  warning: IngestWarning,
) => Promise<void> | void;

export type DiscoveryEventHandler = (
  discoveryEvent: DiscoveryEvent,
) => Promise<void> | void;

export type SessionIngestServiceOptions = {
  roots: DiscoveryRootConfig[];
  registries: IngestProviderRegistry[];
  cursorStore?: CursorStore;
  watchIntervalMs?: number;
  onRecord?: IngestRecordHandler;
  /** Final verified progress; scan buffers use this before their storage transaction. */
  onCursor?: (cursor: IngestCursor) => void | Promise<void>;
  onObservedEvent?: ObservedEventHandler;
  onObservedSession?: ObservedSessionHandler;
  onWarning?: IngestWarningHandler;
  onDiscoveryEvent?: DiscoveryEventHandler;
};

export interface SessionIngestService {
  readonly roots: DiscoveryRootConfig[];

  /**
   * Performs an initial scan across all active roots, then starts watch processing
   * only for roots configured with `watch: true`.
   */
  start(): Promise<void>;
  /** Stops active watch processing and emits watch shutdown events for watched roots. */
  stop(): Promise<void>;
  /** Performs an immediate full scan across all active roots. */
  scanNow(): Promise<void>;
  /** Reconciles current filesystem state across all active roots. */
  reconcileNow(): Promise<void>;
}
