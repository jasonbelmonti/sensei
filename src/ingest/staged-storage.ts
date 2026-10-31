import { createSourceAvailability } from "./source-availability.js";
import type { SenseiStorage } from "../storage/database.js";
import { createRecordSpool } from "./record-spool.js";
import { publishIngestFile } from "./publish-file.js";
import type { SessionIngestServiceOptions } from "./contracts.js";
import { mapPassiveScanWarningToStorageInput } from "./record-mapper.js";
import { type PassiveScanWriteSummary } from "./storage-writer.js";

export type IngestionCoverage = {
	discovered: number;
	read: number;
	skipped: number;
	partial: number;
	humanMessages: number;
	toolItems: number;
	diagnostics: string[];
};
export const emptyWriteSummary = (): PassiveScanWriteSummary => ({
	processedRecords: 0,
	sessionWrites: 0,
	turnWrites: 0,
	turnUsageWrites: 0,
	toolEventWrites: 0,
	cursorWrites: 0,
	warningWrites: 0,
});

/** Private disk spool bounds memory and separates parsing from authoritative publication. */
export function createStagedStorage(
	storage: SenseiStorage,
	mode: "scan" | "watch" = "scan",
) {
	const spool = createRecordSpool();
	const sourceAvailability = createSourceAvailability(storage);
	const coverage: IngestionCoverage = {
		discovered: 0,
		read: 0,
		skipped: 0,
		partial: 0,
		humanMessages: 0,
		toolItems: 0,
		diagnostics: [],
	};
	const summary = emptyWriteSummary();
	const partial = new Set<string>();
	let discoveredFile: string | undefined;
	let published = false;
	let retainedPartial = false;
	let closed = false;
	const markPartial = (path: string, message: string) => {
		if (!partial.has(path)) {
			partial.add(path);
			coverage.partial++;
		}
		if (coverage.diagnostics.length < 100)
			coverage.diagnostics.push(`${path}: ${message}`);
	};
	const bindings: Pick<
		SessionIngestServiceOptions,
		"cursorStore" | "onRecord" | "onCursor" | "onWarning" | "onDiscoveryEvent"
	> = {
		cursorStore: {
			async get(key) {
				const source = storage.database
					.query(
						"SELECT availability FROM evidence_sources WHERE provider=? AND file_path=?",
					)
					.get(key.provider, key.filePath) as { availability: string } | null;
				if (source?.availability === "unavailable") return null;
				return storage.ingestState.getCursor(
					key.provider,
					key.rootPath,
					key.filePath,
				);
			},
			async set() {
				/* Publication owns persistent progress. */
			},
			async delete() {
				/* Keep old generation until replacement commits. */
			},
		},
		onRecord(record) {
			if (
				record.completeness === "partial" &&
				!partial.has(record.source.filePath)
			)
				markPartial(
					record.source.filePath,
					"Source contains unsupported or incomplete records",
				);
			spool.append(record);
		},
		async onCursor(cursor) {
			await publishIngestFile(
				storage,
				spool,
				cursor,
				partial.has(cursor.filePath),
				summary,
				mode,
			);
			summary.cursorWrites++;
			coverage.read++;
			published = true;
			for (const rows of spool.batches())
				for (const record of rows) {
					if (record.kind !== "event") continue;
					if (record.evidence?.kind === "human") coverage.humanMessages++;
					if (record.evidence?.kind === "tool") coverage.toolItems++;
				}
			spool.clear();
		},
		onWarning(warning) {
			if (
				!["cursor-reset", "truncated-file", "rotated-file"].includes(
					warning.code,
				)
			)
				markPartial(
					warning.filePath ??
						warning.source?.filePath ??
						warning.provider ??
						"source",
					warning.message,
				);
			storage.ingestState.recordWarning(
				mapPassiveScanWarningToStorageInput({
					...warning,
					cause:
						warning.cause instanceof Error
							? { message: warning.cause.message }
							: undefined,
				}),
			);
			summary.warningWrites++;
		},
		onDiscoveryEvent(event) {
			sourceAvailability(event);
			if (event.type === "file.discovered" || event.type === "file.changed") {
				if (discoveredFile && !published) {
					coverage.skipped++;
					if (retainedPartial)
						markPartial(discoveredFile, "Retained source coverage is partial");
				}
				discoveredFile = event.filePath;
				published = false;
				coverage.discovered++;
				const prior = storage.database
					.query(
						"SELECT availability FROM evidence_sources WHERE provider=? AND file_path=?",
					)
					.get(event.provider, event.filePath) as {
					availability: string;
				} | null;
				retainedPartial = prior?.availability === "partial";
				spool.clear();
			}
			if (event.type === "root.skipped") {
				coverage.skipped++;
				markPartial(
					event.filePath ?? event.rootPath,
					event.detail ?? "Root unavailable",
				);
			}
			if (event.type === "file.deleted" && event.filePath) {
				const path = event.filePath;
				storage.transaction(() =>
					storage.evidence.source(event.provider, path, "", "unavailable"),
				);
			}
		},
	};
	return {
		bindings,
		coverage,
		summary,
		close() {
			if (closed) return;
			closed = true;
			if (discoveredFile && !published) {
				coverage.skipped++;
				if (retainedPartial)
					markPartial(discoveredFile, "Retained source coverage is partial");
			}
			spool.close();
		},
	};
}
