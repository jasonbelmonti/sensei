import type { IngestParseContext, ObservedIngestRecord } from "../contracts.js";
import { decodeArchive } from "../files/archive.js";
import { streamJsonl } from "../files/jsonl-stream.js";
import { parseCurrentTranscript } from "../current/parser.js";
import { decodeCurrentCodex } from "./current-decoder.js";
import { parseCodexTranscriptFile } from "./transcript-parser.js";

export async function* parseCodexSource(
	context: IngestParseContext,
): AsyncIterable<ObservedIngestRecord> {
	const archive = context.filePath.endsWith(".zst")
		? await decodeArchive(context.filePath, context.signal)
		: undefined;
	try {
		const path = archive?.path ?? context.filePath;
		if (
			context.cursor?.metadata?.currentFormat ||
			(await hasRichItems(path, archive ? undefined : context.byteLength))
		) {
			yield* parseCurrentTranscript(context, decodeCurrentCodex, path);
		} else if (archive) {
			// Archives without qualified provenance remain visible as unsupported coverage.
			throw new Error(
				"Compressed Codex source has no qualified rich item records",
			);
		} else {
			yield* parseCodexTranscriptFile(context);
		}
	} finally {
		await archive?.cleanup();
	}
}
async function hasRichItems(path: string, size?: number): Promise<boolean> {
	for await (const line of streamJsonl(path, 0, size)) {
		try {
			const record = JSON.parse(line.text);
			if (
				record.type === "event_msg" &&
				record.payload?.type === "item_completed"
			)
				return true;
		} catch {
			/* Framing and coverage are reported by the selected reader. */
		}
	}
	return false;
}
