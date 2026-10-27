// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.

import type { AgentEvent, SessionReference } from "../event-contract.js";
import {
  asString,
  compactUnknownRecord,
  isRecord,
} from "./normalize-values.js";

type ClaudeIngestSession = SessionReference | null;
export function normalizeSystemRecord(
  record: Record<string, unknown>,
  session: ClaudeIngestSession,
): AgentEvent[] | null | undefined {
  switch (asString(record.subtype)) {
    case "init":
      return null;
    case "status":
      return [
        {
          type: "status",
          provider: "claude",
          session,
          status: asString(record.status) ?? "idle",
          detail: asString(record.permissionMode),
          raw: record,
        },
      ];
    case "files_persisted": {
      const event = normalizeFilesPersistedRecord(record, session);
      return event ? [event] : undefined;
    }
    case "task_started": {
      const event = normalizeTaskStartedRecord(record, session);
      return event ? [event] : undefined;
    }
    case "task_progress": {
      const event = normalizeTaskProgressRecord(record, session);
      return event ? [event] : undefined;
    }
    case "task_notification": {
      const event = normalizeTaskNotificationRecord(record, session);
      return event ? [event] : undefined;
    }
    default:
      return;
  }
}

export function normalizeFilesPersistedRecord(
  record: Record<string, unknown>,
  session: ClaudeIngestSession,
): AgentEvent | undefined {
  const changes = Array.isArray(record.files)
    ? record.files.flatMap((file) => {
        if (!isRecord(file)) {
          return [];
        }

        const path = asString(file.filename);
        return path ? [{ path, changeType: "update" as const }] : [];
      })
    : [];
  const failed = Array.isArray(record.failed)
    ? record.failed.flatMap((file) => {
        if (!isRecord(file)) {
          return [];
        }

        const path = asString(file.filename);
        if (!path) {
          return [];
        }

        return [
          {
            path,
            error: asString(file.error),
          },
        ];
      })
    : [];

  if (changes.length === 0 && failed.length === 0) {
    return;
  }

  return {
    type: "file.changed",
    provider: "claude",
    session,
    changes,
    outcome: failed.length > 0 ? "error" : "success",
    raw: record,
    extensions: failed.length > 0 ? { failed } : undefined,
  };
}

export function normalizeTaskStartedRecord(
  record: Record<string, unknown>,
  session: ClaudeIngestSession,
): AgentEvent | undefined {
  const toolCallId = getTaskToolCallId(record);
  if (!toolCallId) {
    return;
  }

  return {
    type: "tool.started",
    provider: "claude",
    session,
    toolCallId,
    toolName: asString(record.task_type) ?? "task",
    kind: "custom",
    input: compactUnknownRecord({
      description: asString(record.description),
      prompt: asString(record.prompt),
    }),
    raw: record,
    extensions: compactUnknownRecord({
      taskId: asString(record.task_id),
    }),
  };
}

export function normalizeTaskProgressRecord(
  record: Record<string, unknown>,
  session: ClaudeIngestSession,
): AgentEvent | undefined {
  const toolCallId = getTaskToolCallId(record);
  if (!toolCallId) {
    return;
  }

  return {
    type: "tool.updated",
    provider: "claude",
    session,
    toolCallId,
    statusText: asString(record.description),
    output: compactUnknownRecord({
      usage: isRecord(record.usage) ? record.usage : undefined,
      lastToolName: asString(record.last_tool_name),
    }),
    raw: record,
    extensions: compactUnknownRecord({
      taskId: asString(record.task_id),
    }),
  };
}

export function normalizeTaskNotificationRecord(
  record: Record<string, unknown>,
  session: ClaudeIngestSession,
): AgentEvent | undefined {
  const toolCallId = getTaskToolCallId(record);
  if (!toolCallId) {
    return;
  }

  return {
    type: "tool.completed",
    provider: "claude",
    session,
    toolCallId,
    toolName: "task",
    kind: "custom",
    outcome: normalizeTaskNotificationOutcome(record),
    output: compactUnknownRecord({
      summary: asString(record.summary),
      outputFile: asString(record.output_file),
      usage: isRecord(record.usage) ? record.usage : undefined,
    }),
    raw: record,
    extensions: compactUnknownRecord({
      taskId: asString(record.task_id),
    }),
  };
}

export function normalizeTaskNotificationOutcome(
  record: Record<string, unknown>,
): "success" | "error" | "cancelled" {
  switch (asString(record.status)) {
    case "completed":
      return "success";
    case "stopped":
      return "cancelled";
    default:
      return "error";
  }
}

export function getTaskToolCallId(
  record: Record<string, unknown>,
): string | undefined {
  return asString(record.tool_use_id) ?? asString(record.task_id);
}
