import type {
  StoredToolEventRecord,
  StoredTurnRecord,
  StoredTurnUsageRecord,
} from "./schema";

export const ANALYSIS_TURN_ORDER_COLUMNS = [
  "started_at",
  "completed_at",
  "failed_at",
  "updated_at",
  "turn_id",
] as const;

export const ANALYSIS_TOOL_EVENT_ORDER_COLUMNS = [
  "started_at",
  "completed_at",
  "updated_at",
  "tool_call_id",
] as const;

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
  turn: StoredTurnRecord;
  usage?: StoredTurnUsageRecord;
  toolEvents: readonly StoredToolEventRecord[];
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

function compareSortTimestampAndId(
  leftTimestamp: string,
  rightTimestamp: string,
  leftId: string,
  rightId: string,
): number {
  const timestampComparison = leftTimestamp.localeCompare(rightTimestamp);

  if (timestampComparison !== 0) {
    return timestampComparison;
  }

  return leftId.localeCompare(rightId);
}
