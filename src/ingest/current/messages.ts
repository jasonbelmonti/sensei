import type { CurrentState, DecodedRecord } from "./types.js";
import { eventBase } from "./types.js";
import type { ProviderId } from "../event-contract.js";

export function message(
	provider: ProviderId,
	state: CurrentState,
	id: string,
	text: string,
	role: "human" | "assistant",
	timestamp?: string,
): DecodedRecord {
	if (!state.sessionId || !state.turnId || !timestamp)
		return {
			events: [],
			warning:
				"Visible message is missing source session, turn or observation time",
		};
	const base = eventBase(provider, state, timestamp);
	const events: DecodedRecord["events"] = [];
	if (role === "human" && !state.started) {
		state.started = true;
		events.push({ ...base, type: "turn.started", input: { prompt: text } });
	}
	if (role === "assistant") state.latestText = text;
	events.push({
		...base,
		type: "message.completed",
		messageId: id,
		role: role === "human" ? "user" : "assistant",
		text,
	});
	return {
		events,
		evidence: {
			provider,
			sessionId: state.sessionId,
			turnId: state.turnId,
			itemId: id,
			kind: role,
			text,
			observedAt: timestamp,
		},
	};
}
export function tool(
	provider: ProviderId,
	state: CurrentState,
	id: string,
	name: string,
	text: string,
	outcome: "success" | "error" | "cancelled",
	timestamp?: string,
	wrapper = false,
): DecodedRecord {
	if (!state.sessionId || !state.turnId || !timestamp)
		return {
			events: [],
			warning:
				"Tool outcome is missing source session, turn or observation time",
		};
	return {
		events: [
			{
				...eventBase(provider, state, timestamp),
				type: "tool.completed",
				toolCallId: wrapper ? `wrapper:${id}` : id,
				toolName: name,
				kind: wrapper ? "custom" : "unknown",
				output: text,
				outcome,
			},
		],
		evidence: {
			provider,
			sessionId: state.sessionId,
			turnId: state.turnId,
			itemId: id,
			kind: "tool",
			text,
			observedAt: timestamp,
			outcome,
			toolName: name,
			wrapper,
		},
	};
}
