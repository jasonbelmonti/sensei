import type { OrderedAnalysisTurnSessionContext } from "../analysis-ordering";
import { parseJsonRecord } from "./shared";

const SESSION_THREAD_NAME_FIELD = "threadName";
const SESSION_TAGS_FIELD = "tags";

export type AnalysisTurnSessionContextRow = {
	sessionWorkingDirectory: string | null;
	sessionMetadataJson: string | null;
};

export function mapOrderedTurnSessionContext(
	row: AnalysisTurnSessionContextRow,
): OrderedAnalysisTurnSessionContext {
	const metadata = parseJsonRecord(row.sessionMetadataJson);

	return {
		workingDirectory: row.sessionWorkingDirectory ?? undefined,
		metadata,
		threadName: readStringMetadataField(metadata, SESSION_THREAD_NAME_FIELD),
		tags: readStringArrayMetadataField(metadata, SESSION_TAGS_FIELD),
	};
}

function readStringMetadataField(
	metadata: OrderedAnalysisTurnSessionContext["metadata"],
	field: string,
): string | undefined {
	const value = metadata?.[field];

	return typeof value === "string" ? value : undefined;
}

function readStringArrayMetadataField(
	metadata: OrderedAnalysisTurnSessionContext["metadata"],
	field: string,
): string[] {
	const value = metadata?.[field];

	if (Array.isArray(value) === false) {
		return [];
	}

	return value.filter((entry): entry is string => typeof entry === "string");
}
