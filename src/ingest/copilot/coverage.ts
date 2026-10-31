import { dirname, join, basename } from "node:path";

/** Metadata-only sessions are not authoritative event histories. */
export function unavailableCopilotSessions(paths: Iterable<string>): string[] {
	const files = new Set(paths);
	return [...files]
		.filter(
			(path) =>
				basename(path) === "workspace.yaml" &&
				!files.has(join(dirname(path), "events.jsonl")),
		)
		.map(dirname);
}
