import type { AgentEvent, ProviderId } from "../event-contract.js";
import type { EvidenceObservation } from "../../evidence/contracts.js";

export type CurrentState = {
	sessionId?: string;
	partialCoverage?: boolean;
	turnId?: string;
	started?: boolean;
	latestText?: string;
	toolNames?: Record<string, string>;
};
export type DecodedRecord = {
	events: AgentEvent[];
	evidence?: EvidenceObservation;
	warning?: string;
};
export type CurrentDecoder = (
	record: Record<string, unknown>,
	state: CurrentState,
) => DecodedRecord;
export const object = (value: unknown): Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
export const string = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;
export function visibleText(value: unknown): string {
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return "";
	return value
		.filter((x) =>
			["text", "Text", "input_text", "output_text"].includes(
				object(x).type as string,
			),
		)
		.map((x) => string(object(x).text) ?? "")
		.join("\n");
}
export function eventBase(
	provider: ProviderId,
	state: CurrentState,
	timestamp?: string,
) {
	return {
		provider,
		session: state.sessionId ? { provider, sessionId: state.sessionId } : null,
		turnId: state.turnId,
		timestamp,
	};
}
