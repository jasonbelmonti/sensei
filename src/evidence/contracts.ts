import type { StorageProviderId } from "../storage/schema.js";

/** Visible source observations, independent of later operator-authored task records. */
export type EvidenceObservation = {
	provider: StorageProviderId;
	sessionId: string;
	turnId: string;
	itemId: string;
	sourceEventId?: string;
	links?: {
		url: string;
		availability: "unverified";
		verification: "reported";
	}[];
	kind: "human" | "assistant" | "tool";
	text: string;
	observedAt: string;
	outcome?: "success" | "error" | "cancelled";
	toolName?: string;
	wrapper?: boolean;
};
