import type {
	JsonRecord,
	StoredToolEventRecord,
	StoredTurnRecord,
	StoredTurnUsageRecord,
} from "./schema";

const SQLITE_BINARY_TEXT_ENCODER = new TextEncoder();

export const ANALYSIS_TURN_ORDER_BY_SQL_TERMS = [
	"COALESCE(started_at, completed_at, failed_at, updated_at)",
	"turn_id",
] as const;
export const ANALYSIS_TURN_ORDER_BY_SQL =
	ANALYSIS_TURN_ORDER_BY_SQL_TERMS.join(", ");

export const ANALYSIS_TOOL_EVENT_ORDER_BY_SQL_TERMS = [
	"COALESCE(started_at, completed_at, updated_at)",
	"tool_call_id",
] as const;
export const ANALYSIS_TOOL_EVENT_ORDER_BY_SQL =
	ANALYSIS_TOOL_EVENT_ORDER_BY_SQL_TERMS.join(", ");

type AnalysisTurnSortRecord = Pick<
	StoredTurnRecord,
	"turnId" | "startedAt" | "completedAt" | "failedAt" | "updatedAt"
>;

type AnalysisToolEventSortRecord = Pick<
	StoredToolEventRecord,
	"toolCallId" | "startedAt" | "completedAt" | "updatedAt"
>;

export type OrderedAnalysisTurnInput = {
	turnSequence: number;
	session: OrderedAnalysisTurnSessionContext;
	turn: StoredTurnRecord;
	usage?: StoredTurnUsageRecord;
	toolEvents: readonly StoredToolEventRecord[];
};

export type OrderedAnalysisTurnSessionContext = {
	workingDirectory?: string;
	metadata?: JsonRecord;
	threadName?: string;
	tags: readonly string[];
};

export function getAnalysisTurnSortTimestamp(
	turn: AnalysisTurnSortRecord,
): string {
	return turn.startedAt ?? turn.completedAt ?? turn.failedAt ?? turn.updatedAt;
}

export function compareAnalysisTurns(
	left: AnalysisTurnSortRecord,
	right: AnalysisTurnSortRecord,
): number {
	return compareSortTimestampAndId(
		getAnalysisTurnSortTimestamp(left),
		getAnalysisTurnSortTimestamp(right),
		left.turnId,
		right.turnId,
	);
}

export function sortAnalysisTurns<T extends AnalysisTurnSortRecord>(
	turns: readonly T[],
): T[] {
	return [...turns].sort(compareAnalysisTurns);
}

export function getAnalysisToolEventSortTimestamp(
	toolEvent: AnalysisToolEventSortRecord,
): string {
	return toolEvent.startedAt ?? toolEvent.completedAt ?? toolEvent.updatedAt;
}

export function compareAnalysisToolEvents(
	left: AnalysisToolEventSortRecord,
	right: AnalysisToolEventSortRecord,
): number {
	return compareSortTimestampAndId(
		getAnalysisToolEventSortTimestamp(left),
		getAnalysisToolEventSortTimestamp(right),
		left.toolCallId,
		right.toolCallId,
	);
}

export function sortAnalysisToolEvents<T extends AnalysisToolEventSortRecord>(
	toolEvents: readonly T[],
): T[] {
	return [...toolEvents].sort(compareAnalysisToolEvents);
}

export function createAnalysisTurnOrderBySql(tableAlias?: string): string {
	return createQualifiedOrderBySql(
		["started_at", "completed_at", "failed_at", "updated_at"],
		"turn_id",
		tableAlias,
	);
}

export function createAnalysisToolEventOrderBySql(tableAlias?: string): string {
	return createQualifiedOrderBySql(
		["started_at", "completed_at", "updated_at"],
		"tool_call_id",
		tableAlias,
	);
}

function compareSortTimestampAndId(
	leftTimestamp: string,
	rightTimestamp: string,
	leftId: string,
	rightId: string,
): number {
	const timestampComparison = compareSqliteBinaryText(
		leftTimestamp,
		rightTimestamp,
	);

	if (timestampComparison !== 0) {
		return timestampComparison;
	}

	return compareSqliteBinaryText(leftId, rightId);
}

function compareSqliteBinaryText(left: string, right: string): number {
	const leftBytes = SQLITE_BINARY_TEXT_ENCODER.encode(left);
	const rightBytes = SQLITE_BINARY_TEXT_ENCODER.encode(right);
	const sharedLength = Math.min(leftBytes.length, rightBytes.length);

	for (let index = 0; index < sharedLength; index += 1) {
		const byteDifference = leftBytes[index] - rightBytes[index];

		if (byteDifference !== 0) {
			return byteDifference;
		}
	}

	return leftBytes.length - rightBytes.length;
}

function createQualifiedOrderBySql(
	coalescedColumns: readonly string[],
	idColumn: string,
	tableAlias?: string,
): string {
	const qualifyColumn = (column: string) =>
		tableAlias ? `${tableAlias}.${column}` : column;

	return [
		`COALESCE(${coalescedColumns.map(qualifyColumn).join(", ")})`,
		qualifyColumn(idColumn),
	].join(", ");
}
