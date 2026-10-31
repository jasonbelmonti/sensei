import { stat } from "node:fs/promises";
import type {
	IngestParseContext,
	ObservedIngestRecord,
	IngestCursor,
} from "../contracts.js";
import { readCursorCheckpoint } from "../files/continuity.js";
import { streamJsonl } from "../files/jsonl-stream.js";
import {
	object,
	type CurrentDecoder,
	type DecodedRecord,
	type CurrentState,
} from "./types.js";

export async function* parseCurrentTranscript(
	context: IngestParseContext,
	decode: CurrentDecoder,
	decodedPath = context.filePath,
): AsyncIterable<ObservedIngestRecord> {
	const archive = decodedPath !== context.filePath;
	const extent = context.byteLength ?? (await stat(context.filePath)).size;
	const digest = (await readCursorCheckpoint(context.filePath, extent)).token;
	const state: CurrentState = archive
		? {}
		: { ...object(context.cursor?.metadata?.currentState) };
	const size = archive ? (await stat(decodedPath)).size : extent;
	const start = archive ? 0 : (context.cursor?.byteOffset ?? 0);
	const firstLine = archive
		? 1
		: (context.cursor?.line ?? 0) +
			(context.cursor?.metadata?.senseiEndedAtNewline === false ? 0 : 1);
	let partial = state.partialCoverage ?? false;
	let latest: IngestCursor | undefined;
	const source = {
		provider: context.root.provider,
		kind: "transcript" as const,
		discoveryPhase: context.discoveryPhase,
		rootPath: context.root.path,
		filePath: context.filePath,
		metadata: { sha256: digest, format: "current", archive },
	};
	for await (const line of streamJsonl(decodedPath, start, size, firstLine)) {
		let record: Record<string, unknown>;
		let malformed = false;
		try {
			record = line.text ? object(JSON.parse(line.text)) : {};
		} catch {
			if (!line.terminated) {
				await context.onIncompleteLine?.();
				partial = true;
				if (archive)
					throw new Error(
						"Incomplete archive final JSONL record; snapshot remains uncommitted",
					);
				break;
			}
			record = {};
			malformed = true;
		}
		const result: DecodedRecord = malformed
			? { events: [], warning: `Invalid JSON at line ${line.line}` }
			: line.text
				? decode(record, state)
				: { events: [] };
		if (result.evidence) {
			if (context.root.provider === "copilot" && typeof record.id === "string")
				result.evidence.sourceEventId = record.id;
			const urls = [
				...new Set(result.evidence.text.match(/https?:\/\/[^\s<>"\)]+/g) ?? []),
			];
			if (urls.length)
				result.evidence.links = urls.map((url) => ({
					url,
					availability: "unverified",
					verification: "reported",
				}));
		}
		if (result.warning) {
			partial = true;
			state.partialCoverage = true;
		}
		latest = {
			provider: context.root.provider,
			rootPath: context.root.path,
			filePath: context.filePath,
			byteOffset: archive ? extent : line.offset,
			line: line.line,
			continuityToken: line.token,
			metadata: {
				currentState: structuredClone(state),
				currentFormat: true,
				senseiEndedAtNewline: line.terminated,
				sha256: digest,
				archive,
			},
		};
		const location = { line: line.line, byteOffset: line.offset };
		const warnings = result.warning
			? [
					{
						code: malformed
							? ("parse-failed" as const)
							: ("unsupported-record" as const),
						message: result.warning,
						source: { ...source, location },
						provider: context.root.provider,
						filePath: context.filePath,
					},
				]
			: [];
		const session = {
			provider: context.root.provider,
			sessionId: state.sessionId ?? `file:${context.filePath}`,
			state: state.sessionId
				? ("canonical" as const)
				: ("provisional" as const),
		};
		if (!result.events.length) {
			yield {
				kind: "session",
				observedSession: session,
				source: { ...source, location },
				reason: "transcript",
				completeness: partial ? "partial" : "complete",
				cursor: latest,
				warnings,
			};
		}
		for (let index = 0; index < result.events.length; index++) {
			yield {
				kind: "event",
				event: result.events[index],
				evidence:
					index === result.events.length - 1 ? result.evidence : undefined,
				observedSession: session,
				source: { ...source, location },
				completeness: partial ? "partial" : "complete",
				cursor: latest,
				warnings: index === 0 ? warnings : [],
			};
		}
	}
	if (latest)
		yield {
			kind: "session",
			observedSession: {
				provider: context.root.provider,
				sessionId: state.sessionId ?? `file:${context.filePath}`,
				state: state.sessionId ? "canonical" : "provisional",
			},
			source: {
				...source,
				location: { line: latest.line, byteOffset: latest.byteOffset },
			},
			reason: "transcript",
			completeness: partial ? "partial" : "complete",
			cursor: latest,
		};
}
