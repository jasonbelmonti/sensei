import { existsSync } from "node:fs";
import type { SenseiStorage } from "../storage/database.js";
import type { DiscoveryEvent } from "./contracts.js";

/** Compare each completed root scan with retained source locators, including across restarts. */
export function createSourceAvailability(storage: SenseiStorage) {
	return (event: DiscoveryEvent) => {
		if (
			!["scan.completed", "reconcile.completed", "root.skipped"].includes(
				event.type,
			)
		)
			return;
		if (event.type === "root.skipped" && event.filePath) return; // metadata-only session diagnostic
		const known = storage.database
			.query(`SELECT c.file_path AS path,s.availability FROM ingest_cursors c
      JOIN evidence_sources s ON s.provider=c.provider AND s.file_path=c.file_path
      WHERE c.provider=? AND c.root_path=?`)
			.all(event.provider, event.rootPath) as {
			path: string;
			availability: string;
		}[];
		storage.transaction(() => {
			for (const source of known) {
				if (event.type === "root.skipped" || !existsSync(source.path))
					storage.evidence.source(
						event.provider,
						source.path,
						"",
						"unavailable",
					);
			}
		});
	};
}
