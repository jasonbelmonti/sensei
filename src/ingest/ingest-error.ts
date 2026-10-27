import type { ProviderId } from "./event-contract.js";

type FailureCode =
  | "aborted"
  | "missing_cli"
  | "needs_auth"
  | "permission_denied"
  | "provider_failure"
  | "structured_output_invalid"
  | "unsupported_feature"
  | "unknown";

/** A persisted provider failure, not an agent execution API. */
export class IngestError extends Error {
  readonly code: FailureCode;
  readonly provider: ProviderId;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly raw?: unknown;
  readonly extensions?: Record<string, unknown>;
  constructor(options: {
    code: FailureCode;
    provider: ProviderId;
    message: string;
    details?: Readonly<Record<string, unknown>>;
    raw?: unknown;
    extensions?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = "IngestError";
    this.code = options.code;
    this.provider = options.provider;
    this.details = options.details;
    this.raw = options.raw;
    this.extensions = options.extensions;
  }
}
