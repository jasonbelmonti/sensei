import type { SenseiStorage } from "../storage/database.js";
import type { IngestCursor, ObservedIngestRecord } from "./contracts.js";
import type { RecordSpool } from "./record-spool.js";
import type { SenseiPassiveScanRecord } from "./scan-result.js";
import {
	writePassiveScanResultToStorage,
	type PassiveScanWriteSummary,
} from "./storage-writer.js";

/** Publish an archive atomically, or complete plain-file offset groups in bounded transactions. */
export async function publishIngestFile(
	storage: SenseiStorage,
	spool: RecordSpool,
	cursor: IngestCursor,
	partial: boolean,
	summary: PassiveScanWriteSummary,
	mode: "scan" | "watch" = "scan",
) {
	if (cursor.metadata?.archive || !cursor.metadata?.currentFormat) {
		storage.transaction(() => {
			for (const records of spool.batches(cursor.byteOffset)) {
				if (!cursor.metadata?.currentFormat && mode === "watch") {
					for (const record of records) write(storage, summary, [record], true);
				} else write(storage, summary, records);
			}
			finish(storage, cursor, partial);
		});
	} else {
		// Publish complete offset groups; restart state must never bisect a source record.
		const carry: ObservedIngestRecord[] = [];
		for (const rows of spool.batches(cursor.byteOffset)) {
			carry.push(...rows);
			const lastOffset = carry.at(-1)?.cursor?.byteOffset;
			const split = carry.findIndex((r) => r.cursor?.byteOffset === lastOffset);
			if (split <= 0) continue;
			const batch = carry.splice(0, split);
			const last = batch.at(-1)?.cursor;
			if (!last) continue;
			const progress = {
				...cursor,
				...last,
				fingerprint: cursor.fingerprint,
				continuityToken: last.continuityToken,
				metadata: {
					...cursor.metadata,
					...last.metadata,
					senseiEndedAtNewline: last.metadata?.senseiEndedAtNewline,
				},
			};
			storage.transaction(() => {
				write(storage, summary, batch);
				finish(storage, progress, true);
			});
		}
		storage.transaction(() => {
			write(storage, summary, carry);
			finish(storage, cursor, partial);
		});
	}
}
function write(
	storage: SenseiStorage,
	summary: PassiveScanWriteSummary,
	records: ObservedIngestRecord[],
	retainMissingSessionMetadata = false,
) {
	const mapped: SenseiPassiveScanRecord[] = records.map((record) =>
		record.kind === "event"
			? { kind: "event", observedEvent: { ...record, cursor: undefined } }
			: {
					kind: "session",
					observedSession: { ...record, cursor: undefined },
				},
	);
	const count = writePassiveScanResultToStorage(
		storage,
		{
			records: mapped,
			warnings: [],
			discoveryEvents: [],
		},
		{ retainMissingSessionMetadata },
	);
	for (const key of Object.keys(summary) as (keyof PassiveScanWriteSummary)[])
		summary[key] += count[key];
}
function finish(
	storage: SenseiStorage,
	cursor: IngestCursor,
	partial: boolean,
) {
	storage.ingestState.deleteCursor(
		cursor.provider,
		cursor.rootPath,
		cursor.filePath,
	);
	storage.ingestState.setCursor(cursor);
	const digest = cursor.metadata?.sha256;
	if (typeof digest === "string")
		storage.evidence.source(
			cursor.provider,
			cursor.filePath,
			digest,
			partial ? "partial" : "available",
		);
}
