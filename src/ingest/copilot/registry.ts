import type { IngestProviderRegistry } from "../contracts.js";
import { parseCurrentTranscript } from "../current/parser.js";
import { decodeCopilot } from "./decoder.js";

export function createCopilotIngestRegistry(): IngestProviderRegistry {
	return {
		provider: "copilot",
		matchFile(path) {
			return /(?:^|[/\\])events\.jsonl$/i.test(path)
				? { kind: "transcript" }
				: null;
		},
		parseFile(context) {
			return parseCurrentTranscript(context, decodeCopilot);
		},
	};
}
