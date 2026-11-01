import { message, tool } from "../current/messages.js";
import {
	eventBase,
	object,
	string,
	visibleText,
	type CurrentDecoder,
} from "../current/types.js";

const metadata = new Set([
	"system.message",
	"hook.start",
	"hook.end",
	"session.info",
	"session.shutdown",
	"session.resume",
	"session.permissions_changed",
	"session.usage_checkpoint",
	"session.compaction_start",
	"session.compaction_complete",
]);
export const decodeCopilot: CurrentDecoder = (record, state) => {
	const d = object(record.data);
	const timestamp = string(record.timestamp);
	const empty = { events: [] };
	if (record.type === "session.start") {
		state.sessionId = undefined;
		state.turnId = undefined;
		state.toolNames = {};
		state.started = false;
		if (d.version !== 1 || d.producer !== "copilot-agent")
			return { events: [], warning: "Unsupported Copilot session format" };
		state.sessionId = string(d.sessionId);
		return empty;
	}
	if (!state.sessionId)
		return {
			events: [],
			warning: "Copilot source has no supported session header",
		};
	const turnId = string(d.turnId);
	if (
		["user.message", "assistant.message", "tool.execution_complete"].includes(
			String(record.type),
		) &&
		!turnId
	)
		return {
			events: [],
			warning: "Copilot evidence is missing its source turn identity",
		};
	if (turnId && turnId !== state.turnId) {
		state.turnId = turnId;
		state.started = false;
		state.latestText = "";
	}
	if (record.type === "user.message" || record.type === "assistant.message") {
		const id = string(d.messageId) ?? string(record.id);
		if (!id || typeof d.content !== "string")
			return {
				events: [],
				warning: "Copilot message lacks identity or visible content",
			};
		if (!d.content && record.type === "assistant.message") return empty;
		return message(
			"copilot",
			state,
			id,
			d.content,
			record.type === "user.message" ? "human" : "assistant",
			timestamp,
		);
	}
	if (record.type === "tool.execution_start") {
		const id = string(d.toolCallId);
		const name = string(d.toolName);
		if (id && name) {
			state.toolNames ??= {};
			state.toolNames[id] = name;
		}
		return empty;
	}
	if (record.type === "tool.execution_complete") {
		const id = string(d.toolCallId);
		const result = object(d.result);
		if (!id || typeof d.success !== "boolean")
			return {
				events: [],
				warning: "Copilot tool outcome lacks identity or success field",
			};
		const name = state.toolNames?.[id] ?? "unknown";
		if (state.toolNames) delete state.toolNames[id];
		return tool(
			"copilot",
			state,
			id,
			name,
			visibleText(result.content),
			d.success && result.isError !== true ? "success" : "error",
			timestamp,
		);
	}
	if (record.type === "assistant.turn_end") {
		const base = eventBase("copilot", state, timestamp);
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
	if (
		record.type === "assistant.turn_start" ||
		metadata.has(String(record.type))
	)
		return empty;
	return {
		events: [],
		warning: `Unsupported Copilot event: ${String(record.type)}`,
	};
};
