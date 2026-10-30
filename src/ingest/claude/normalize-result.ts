// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.

import type { AgentUsage } from "../event-contract.js";
import { IngestError } from "../ingest-error.js";
import {
  asFiniteNumber,
  asString,
  isRecord,
  isString,
} from "./normalize-values.js";
export function createClaudeResultError(
  record: Record<string, unknown>,
): IngestError {
  const errors = Array.isArray(record.errors)
    ? record.errors.filter(isString).join("\n").trim()
    : "";

  const permissionDenials = Array.isArray(record.permission_denials)
    ? record.permission_denials
    : [];

  const subtype = record.subtype;
  const code: IngestError["code"] =
    subtype === "error_max_structured_output_retries"
      ? "structured_output_invalid"
      : permissionDenials.length > 0
        ? "permission_denied"
        : "provider_failure";

  return new IngestError({
    code,
    provider: "claude",
    message: errors || "Claude returned a result error.",
    details: {
      subtype,
      permissionDenials,
    },
    raw: record,
  });
}

export function resolveClaudeResultText(
  record: Record<string, unknown>,
  assistantText?: string,
): string {
  const resultText = asString(record.result);

  if (resultText && resultText.trim().length > 0) {
    return resultText;
  }

  if (assistantText && assistantText.length > 0) {
    return assistantText;
  }

  if (record.structured_output === undefined) {
    return "";
  }

  return stringifyStructuredOutput(record.structured_output);
}

export function stringifyStructuredOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function parseUsage(
  usageRecord: unknown,
  resultRecord?: Record<string, unknown>,
): AgentUsage | null {
  const usage = readUsageNumbers(usageRecord);
  if (!usage) {
    return null;
  }

  const costUsd = resultRecord
    ? asFiniteNumber(resultRecord.total_cost_usd)
    : null;
  const modelUsage =
    resultRecord && isRecord(resultRecord.modelUsage)
      ? resultRecord.modelUsage
      : undefined;

  return {
    tokens: {
      input: asFiniteNumber(usage.input_tokens) ?? 0,
      output: asFiniteNumber(usage.output_tokens) ?? 0,
      cachedInput: asFiniteNumber(usage.cache_read_input_tokens) ?? undefined,
    },
    costUsd: costUsd ?? undefined,
    providerUsage: {
      cacheCreationInputTokens: asFiniteNumber(
        usage.cache_creation_input_tokens,
      ),
      serviceTier: asString(usage.service_tier),
      modelUsage,
    },
  };
}

export function readUsageNumbers(
  record: unknown,
): Record<string, unknown> | null {
  if (!isRecord(record)) {
    return null;
  }

  if (
    record.input_tokens === undefined &&
    record.output_tokens === undefined &&
    record.cache_read_input_tokens === undefined &&
    record.cache_creation_input_tokens === undefined
  ) {
    return null;
  }

  return record;
}
