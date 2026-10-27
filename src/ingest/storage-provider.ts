import type { ObservedEventSource } from "./contracts.js";

import type {
	StorageEventSource,
	StorageProviderId,
} from "../storage/index.js";

/** Reject invalid runtime input before any storage or cursor mutation. */
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
