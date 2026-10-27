// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.

import type { AgentEvent, SessionReference } from "../event-contract.js";
import {
  asFiniteNumber,
  asString,
  compactUnknownRecord,
  getString,
  readStringArray,
  toOptionalList,
} from "./normalize-values.js";

type ClaudeIngestSession = SessionReference | null;
export function normalizeAuthStatus(
  record: Record<string, unknown>,
): "authenticating" | "ready" | "failed" | "needs-auth" | undefined {
  const status = asString(record.status);
  switch (status) {
    case "authenticating":
    case "ready":
    case "failed":
    case "needs-auth":
      return status;
    default:
      break;
  }

  if (record.isAuthenticating === true) {
    return "authenticating";
  }

  if (asString(record.error)) {
    return "failed";
  }

  if (record.isAuthenticating === false || Array.isArray(record.output)) {
    return "ready";
  }

  return;
}

export function buildAuthStatusDetail(
  record: Record<string, unknown>,
): string | undefined {
  const segments = [
    ...readStringArray(record.output),
    ...toOptionalList(asString(record.error)),
  ].filter((segment) => segment.trim().length > 0);

  if (segments.length > 0) {
    return segments.join("\n");
  }

  return getString(record.detail);
}

export function normalizeToolProgressRecord(
  record: Record<string, unknown>,
  session: ClaudeIngestSession,
): AgentEvent | undefined {
  const toolCallId = asString(record.tool_use_id);
  if (!toolCallId) {
    return;
  }

  return {
    type: "tool.updated",
    provider: "claude",
    session,
    toolCallId,
    statusText: "in_progress",
    output: compactUnknownRecord({
      elapsedTimeSeconds:
        asFiniteNumber(record.elapsed_time_seconds) ?? undefined,
    }),
    raw: record,
    extensions: compactUnknownRecord({
      parentToolUseId: asString(record.parent_tool_use_id),
      taskId: asString(record.task_id),
      toolName: asString(record.tool_name),
    }),
  };
}
