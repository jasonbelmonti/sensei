import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "../storage/sqlite-driver.js";
import type { ObservedIngestRecord } from "./contracts.js";

/** Private disk staging; bounded by record count and serialized bytes on replay. */
export function createRecordSpool() {
	const directory = mkdtempSync(join(tmpdir(), "sensei-ingest-"));
	const stage = new Database(join(directory, "stage.sqlite"));
	stage.exec(
		"CREATE TABLE records (seq INTEGER PRIMARY KEY, json TEXT NOT NULL)",
	);
	const insert = stage.query("INSERT INTO records(json) VALUES(?)");
	function* batches(maxOffset = Number.POSITIVE_INFINITY) {
		let seq = 0;
		let bytes = 0;
		let batch: ObservedIngestRecord[] = [];
		const select = stage.query(
			"SELECT seq,json FROM records WHERE seq>? ORDER BY seq LIMIT 1",
		);
		while (true) {
			const row = select.get(seq) as { seq: number; json: string } | null;
			if (!row) break;
			seq = row.seq;
			bytes += Buffer.byteLength(row.json);
			const record = JSON.parse(row.json) as ObservedIngestRecord;
			if ((record.cursor?.byteOffset ?? 0) > maxOffset) continue;
			batch.push(record);
			if (batch.length >= 100 || bytes >= 1024 * 1024) {
				yield batch;
				batch = [];
				bytes = 0;
			}
		}
		if (batch.length) yield batch;
	}

	return {
		batches,
		append(record: ObservedIngestRecord) {
			insert.run(
				JSON.stringify(record, (_key, value) =>
					value instanceof Error
						? { ...value, name: value.name, message: value.message }
						: value,
				),
			);
		},
		clear() {
			stage.exec("DELETE FROM records");
		},
		close() {
			stage.close();
			rmSync(directory, { recursive: true, force: true });
		},
	};
}
export type RecordSpool = ReturnType<typeof createRecordSpool>;
