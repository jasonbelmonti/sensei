// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.

import type { IngestWarning } from "../contracts.js";
import type { AgentEvent } from "../event-contract.js";
import {
  createClaudeResultError,
  parseUsage,
  resolveClaudeResultText,
} from "./normalize-result.js";
import {
  type ClaudeArtifactNormalizationContext,
  clearLatestAssistantText,
  consumeLatestAssistantText,
  getClaudeArtifactWorkingDirectory,
  getContextSessionKey,
  setLatestAssistantText,
  setWorkingDirectory,
} from "./normalize-state.js";
import {
  buildAuthStatusDetail,
  normalizeAuthStatus,
  normalizeToolProgressRecord,
} from "./normalize-status.js";
import { normalizeSystemRecord } from "./normalize-system.js";
import { createClaudeSessionReference } from "./reference.js";

export {
  type ClaudeArtifactNormalizationContext,
  createClaudeArtifactNormalizationContext,
  createClaudeArtifactNormalizationMetadata,
  getClaudeArtifactWorkingDirectory,
} from "./normalize-state.js";

type ParsedArtifact = {
  events: AgentEvent[];
  warnings: IngestWarning[];
  sessionId?: string;
};

import {
  asString,
  compactUnknownRecord,
  getString,
  isRecord,
  isString,
} from "./normalize-values.js";
export function normalizeClaudeArtifactRecord(
  record: unknown,
  context?: ClaudeArtifactNormalizationContext,
): ParsedArtifact {
  try {
    if (!isRecord(record) || typeof record.type !== "string") {
      return {
        events: [],
        warnings: [
          {
            code: "unsupported-record",
            message: "Skipped malformed Claude record.",
            raw: record,
          },
        ],
      };
    }

    const sessionId = extractSessionId(record);
    const session = sessionId ? createClaudeSessionReference(sessionId) : null;
    const sessionKey = getContextSessionKey(sessionId);
    const recordWorkingDirectory = asString(record.cwd);

    if (recordWorkingDirectory) {
      setWorkingDirectory(context, sessionKey, recordWorkingDirectory);
    }

    switch (record.type) {
      case "user": {
        const prompt = extractMessageText(record.message);

        return {
          sessionId,
          events: [
            {
              type: "turn.started",
              provider: "claude",
              session,
              input: {
                prompt,
              },
              timestamp: asString(record.timestamp),
              raw: record,
              extensions: compactUnknownRecord({
                cwd:
                  recordWorkingDirectory ??
                  getClaudeArtifactWorkingDirectory(context, sessionId),
              }),
            },
          ],
          warnings: [],
        };
      }
      case "assistant": {
        const text = extractMessageText(record.message);

        if (!text) {
          return {
            sessionId,
            events: [],
            warnings: [
              {
                code: "unsupported-record",
                message: "Claude assistant record is missing renderable text.",
                raw: record,
              },
            ],
          };
        }

        setLatestAssistantText(context, sessionKey, text);

        return {
          sessionId,
          events: [
            {
              type: "message.completed",
              provider: "claude",
              session,
              messageId: getString(record.uuid),
              role: "assistant",
              text,
              raw: record,
            },
          ],
          warnings: [],
        };
      }
      case "stream_event": {
        const event = record.event;
        if (!isRecord(event) || event.type !== "content_block_delta") {
          return {
            sessionId,
            events: [],
            warnings: [
              {
                code: "unsupported-record",
                message: "Unsupported Claude stream event payload.",
                raw: record,
              },
            ],
          };
        }

        const delta = event.delta;
        if (
          !isRecord(delta) ||
          delta.type !== "text_delta" ||
          typeof delta.text !== "string"
        ) {
          return {
            sessionId,
            events: [],
            warnings: [
              {
                code: "unsupported-record",
                message: "Unsupported Claude stream delta payload.",
                raw: record,
              },
            ],
          };
        }

        return {
          sessionId,
          events: [
            {
              type: "message.delta",
              provider: "claude",
              session,
              messageId: getString(record.uuid),
              role: "assistant",
              delta: delta.text,
              raw: record,
            },
          ],
          warnings: [],
        };
      }
      case "result": {
        if (record.subtype !== "success") {
          clearLatestAssistantText(context, sessionKey);
          const error = createClaudeResultError(record);
          return {
            sessionId,
            events: [
              {
                type: "turn.failed",
                provider: "claude",
                session,
                error,
                raw: record,
              },
            ],
            warnings: [],
          };
        }

        const assistantText = consumeLatestAssistantText(context, sessionKey);

        return {
          sessionId,
          events: [
            {
              type: "turn.completed",
              provider: "claude",
              session,
              result: {
                provider: "claude",
                session,
                text: resolveClaudeResultText(record, assistantText),
                structuredOutput: record.structured_output,
                usage: parseUsage(record.usage, record),
                stopReason: getString(record.stop_reason),
                raw: record,
              },
              raw: record,
            },
          ],
          warnings: [],
        };
      }
      case "auth_status": {
        const normalizedStatus = normalizeAuthStatus(record);
        if (!normalizedStatus) {
          return {
            sessionId,
            events: [],
            warnings: [
              {
                code: "unsupported-record",
                message: "Unsupported Claude auth status payload.",
                raw: record,
              },
            ],
          };
        }

        return {
          sessionId,
          events: [
            {
              type: "auth.status",
              provider: "claude",
              session,
              status: normalizedStatus,
              detail: buildAuthStatusDetail(record),
              raw: record,
            },
          ],
          warnings: [],
        };
      }
      case "tool_progress": {
        const event = normalizeToolProgressRecord(record, session);
        if (!event) {
          return {
            sessionId,
            events: [],
            warnings: [
              {
                code: "unsupported-record",
                message: "Unsupported Claude tool progress payload.",
                raw: record,
              },
            ],
          };
        }

        return {
          sessionId,
          events: [event],
          warnings: [],
        };
      }
      case "system": {
        const events = normalizeSystemRecord(record, session);

        if (events === null) {
          return {
            sessionId,
            events: [],
            warnings: [],
          };
        }

        if (!events) {
          return {
            sessionId,
            events: [],
            warnings: [
              {
                code: "unsupported-record",
                message: "Unsupported Claude system payload.",
                raw: record,
              },
            ],
          };
        }

        return {
          sessionId,
          events,
          warnings: [],
        };
      }
      default:
        return {
          sessionId,
          events: [],
          warnings: [
            {
              code: "unsupported-record",
              message: `Unsupported Claude event type: ${record.type}`,
              raw: record,
            },
          ],
        };
    }
  } catch (error) {
    return {
      events: [],
      warnings: [
        {
          code: "parse-failed",
          message: "Claude artifact record parsing failed.",
          cause: error,
          raw: record,
        },
      ],
    };
  }
}
function extractMessageText(message: unknown): string {
  if (!isRecord(message)) {
    return "";
  }

  if (isString(message.content)) {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  const contentBlocks = message.content;
  const segments: string[] = [];
  for (const block of contentBlocks) {
    if (!isRecord(block)) {
      continue;
    }

    if (block.type === "text" && typeof block.text === "string") {
      segments.push(block.text);
    }
  }

  return segments.join("");
}
function extractSessionId(record: Record<string, unknown>): string | undefined {
  return asString(record.session_id) ?? asString(record.sessionId);
}
