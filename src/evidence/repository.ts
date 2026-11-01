import { createHash } from "node:crypto";
import type { Database } from "../storage/sqlite-driver.js";
import type { ObservedAgentEvent } from "../ingest/contracts.js";

export function createEvidenceRepository(database: Database) {
	return {
		observe(record: ObservedAgentEvent) {
			const item = record.evidence;
			if (!item) return;
			const digest = record.source.metadata?.sha256;
			const line = record.source.location?.line;
			if (typeof digest !== "string" || !line)
				throw new Error("Evidence requires a source digest and line");
			// Content revisions retain the same logical item identity without rewriting old citations.
			const json = JSON.stringify(item);
			const id = createHash("sha256").update(json).digest("hex");
			database
				.query(
					`INSERT OR IGNORE INTO evidence_observations VALUES(?,?,?,?,?,?,?,?,?)`,
				)
				.run(
					id,
					item.provider,
					item.sessionId,
					item.turnId,
					item.itemId,
					item.kind,
					item.text,
					item.observedAt,
					json,
				);
			database
				.query(`INSERT OR IGNORE INTO evidence_locations VALUES(?,?,?,?,?)`)
				.run(
					id,
					record.source.filePath,
					digest,
					line,
					record.source.location?.byteOffset ?? 0,
				);
		},
		source(
			provider: string,
			filePath: string,
			digest: string,
			availability = "available",
		) {
			const previous = database
				.query(
					"SELECT digest, availability FROM evidence_sources WHERE provider=? AND file_path=?",
				)
				.get(provider, filePath) as {
				digest: string;
				availability: string;
			} | null;
			if (previous?.digest === digest && previous.availability === availability)
				return;
			database.exec(
				"UPDATE evidence_state SET source_generation=source_generation+1 WHERE id=1",
			);
			database
				.query(`INSERT INTO evidence_sources VALUES(?,?,?,(SELECT source_generation FROM evidence_state WHERE id=1),?)
        ON CONFLICT(provider,file_path) DO UPDATE SET digest=excluded.digest,generation=excluded.generation,availability=excluded.availability`)
				.run(provider, filePath, digest, availability);
		},
		list(provider: string, sessionId: string) {
			return database
				.query(
					"SELECT * FROM evidence_observations WHERE provider=? AND session_id=? ORDER BY rowid",
				)
				.all(provider, sessionId);
		},
	};
}
