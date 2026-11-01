import { IngestError } from "../ingest-error.js";
import { inferToolOutcome } from "./normalize-tool-helpers.js";
import { parseMaybeJson } from "./normalize-values.js";
import { message, tool } from "../current/messages.js";
import {
	eventBase,
	object,
	string,
	visibleText,
	type CurrentDecoder,
} from "../current/types.js";

/** Rich UI items are authoritative; model-input envelopes are not human provenance. */
export const decodeCurrentCodex: CurrentDecoder = (record, state) => {
	const p = object(record.payload);
	const timestamp = string(record.timestamp);
	const empty = { events: [] };
	if (record.type === "session_meta") {
		state.sessionId = string(p.id);
		return empty;
	}
	if (record.type === "turn_context") {
		state.turnId = string(p.turn_id) ?? state.turnId;
		return empty;
	}
	if (record.type === "response_item") {
		if (p.type === "custom_tool_call_output" && string(p.call_id)) {
			const text = visibleText(p.output);
			// Transport success describes only the wrapper, never its nested leaf calls.
			return tool(
				"codex",
				state,
				p.call_id as string,
				"wrapper",
				text,
				inferToolOutcome(parseMaybeJson(p.output)).outcome,
				timestamp,
				true,
			);
		}
		if (
			[
				"message",
				"reasoning",
				"function_call",
				"function_call_output",
				"custom_tool_call",
				"web_search_call",
				"compaction",
			].includes(String(p.type))
		)
			return empty;
		return {
			events: [],
			warning: `Unsupported Codex response item: ${String(p.type)}`,
		};
	}
	if (record.type !== "event_msg")
		return {
			events: [],
			warning: `Unsupported Codex record: ${String(record.type)}`,
		};
	if (p.type === "task_started") {
		state.turnId = string(p.turn_id);
		state.started = false;
		state.latestText = "";
		return empty;
	}
	if (p.type === "task_complete") {
		state.turnId = string(p.turn_id) ?? state.turnId;
		const base = eventBase("codex", state, timestamp);
		return {
			events: [
				{
					...base,
					type: "turn.completed",
					result: {
						...base,
						text: state.latestText ?? "",
						usage: null,
						stopReason: "completed",
					},
				},
			],
		};
	}
	if (p.type === "turn_aborted")
		return {
			events: [
				{
					...eventBase("codex", state, timestamp),
					type: "turn.failed",
					error: new IngestError({
						provider: "codex",
						code: "aborted",
						message: string(p.reason) ?? "Codex turn aborted",
					}),
				},
			],
		};
	if (p.type !== "item_completed") {
		if (
			[
				"user_message",
				"agent_message",
				"agent_reasoning",
				"token_count",
				"context_compacted",
				"turn_aborted",
			].includes(String(p.type))
		)
			return empty;
		return {
			events: [],
			warning: `Unsupported Codex event: ${String(p.type)}`,
		};
	}
	if (!string(p.turn_id))
		return { events: [], warning: "Codex item has no source turn identity" };
	const i = object(p.item);
	state.turnId = string(p.turn_id) ?? state.turnId;
	if (p.thread_id && p.thread_id !== state.sessionId)
		return {
			events: [],
			warning: "Codex item session identity conflicts with source header",
		};
	const id = string(i.id);
	if (!id) return { events: [], warning: "Codex item has no identity" };
	if (
		["McpToolCall", "CommandExecution", "FileChange"].includes(
			String(i.type),
		) &&
		!["completed", "failed", "cancelled"].includes(String(i.status))
	)
		return {
			events: [],
			warning: `Unsupported terminal tool status: ${String(i.status)}`,
		};
	switch (i.type) {
		case "UserMessage":
			return message(
				"codex",
				state,
				id,
				visibleText(i.content),
				"human",
				timestamp,
			);
		case "AgentMessage":
			return message(
				"codex",
				state,
				id,
				visibleText(i.content),
				"assistant",
				timestamp,
			);
		case "McpToolCall": {
			const result = object(i.result);
			return tool(
				"codex",
				state,
				id,
				`${String(i.server)}.${String(i.tool)}`,
				visibleText(result.content),
				i.status === "failed" || result.isError === true
					? "error"
					: i.status === "cancelled"
						? "cancelled"
						: "success",
				timestamp,
			);
		}
		case "CommandExecution":
			return tool(
				"codex",
				state,
				id,
				Array.isArray(i.command) ? i.command.join(" ") : String(i.command),
				string(i.aggregated_output) ?? "",
				i.status === "cancelled"
					? "cancelled"
					: i.status === "failed" ||
							(typeof i.exit_code === "number" && i.exit_code !== 0)
						? "error"
						: "success",
				timestamp,
			);
		case "FileChange":
			return tool(
				"codex",
				state,
				id,
				"file-change",
				[string(i.stdout), string(i.stderr)].filter(Boolean).join("\n"),
				i.status === "cancelled"
					? "cancelled"
					: i.status === "failed"
						? "error"
						: "success",
				timestamp,
			);
		case "Reasoning":
		case "ContextCompaction":
			return empty;
		// These shapes do not qualify visible tool results yet. Report that limit.
		default:
			return {
				events: [],
				warning: `Unsupported Codex item: ${String(i.type)}`,
			};
	}
};
