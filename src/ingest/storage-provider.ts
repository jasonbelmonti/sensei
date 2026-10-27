import type { ObservedEventSource } from "@jasonbelmonti/claudex/ingest";

import type {
	StorageEventSource,
	StorageProviderId,
} from "../storage/index.js";

/** Claudex supports more providers than Sensei's existing storage contract. */
export function toStorageProvider(
	provider: ObservedEventSource["provider"],
): StorageProviderId {
	if (provider === "claude" || provider === "codex") return provider;
	throw new Error(`Unsupported Sensei ingest provider: ${provider}`);
}

export function toStorageSource(
	source: ObservedEventSource,
): StorageEventSource {
	return { ...source, provider: toStorageProvider(source.provider) };
}
