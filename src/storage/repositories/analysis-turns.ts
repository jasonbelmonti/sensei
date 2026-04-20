import type { Database } from "bun:sqlite";

import {
	createAnalysisToolEventOrderBySql,
	createAnalysisTurnOrderBySql,
	type OrderedAnalysisTurnInput,
} from "../analysis-ordering";
import type { StoredToolEventRecord } from "../schema";
import {
	mapOrderedTurnSessionContext,
	type AnalysisTurnSessionContextRow,
} from "./analysis-turn-session-context";
import {
	mapToolEventRow,
	mapTurnRow,
	mapTurnUsageRow,
	type ToolEventRow,
	type TurnRow,
	type TurnUsageRow,
} from "./conversation-records";

export type AnalysisTurnRepository = ReturnType<
	typeof createAnalysisTurnRepository
>;

type OrderedAnalysisTurnRow = TurnRow &
	AnalysisTurnSessionContextRow & {
	turnSequence: number;
	inputTokens: number | null;
	outputTokens: number | null;
	cachedInputTokens: number | null;
	costUsd: number | null;
	providerUsageJson: string | null;
	usageUpdatedAt: string | null;
};

type OrderedAnalysisToolEventRow = ToolEventRow;

export function createAnalysisTurnRepository(database: Database) {
	const orderedTurnsBySql = createAnalysisTurnOrderBySql("turns");
	const orderedToolEventsBySql =
		createAnalysisToolEventOrderBySql("tool_events");

	const orderedTurnStatement = database.query(`
    SELECT
      turns.provider,
      turns.session_id as sessionId,
      turns.turn_id as turnId,
      turns.status,
      turns.input_prompt as inputPrompt,
      turns.input_attachments_json as inputAttachmentsJson,
      turns.input_metadata_json as inputMetadataJson,
      turns.output_text as outputText,
      turns.output_structured_output_json as outputStructuredOutputJson,
      turns.stop_reason as stopReason,
      turns.error_code as errorCode,
      turns.error_message as errorMessage,
      turns.error_details_json as errorDetailsJson,
      turns.raw_event_json as rawEventJson,
      turns.extensions_json as extensionsJson,
      turns.started_at as startedAt,
      turns.completed_at as completedAt,
      turns.failed_at as failedAt,
      turns.updated_at as updatedAt,
      sessions.working_directory as sessionWorkingDirectory,
      sessions.session_metadata_json as sessionMetadataJson,
      turn_usage.input_tokens as inputTokens,
      turn_usage.output_tokens as outputTokens,
      turn_usage.cached_input_tokens as cachedInputTokens,
      turn_usage.cost_usd as costUsd,
      turn_usage.provider_usage_json as providerUsageJson,
      turn_usage.updated_at as usageUpdatedAt,
      ROW_NUMBER() OVER (
        PARTITION BY turns.provider, turns.session_id
        ORDER BY ${orderedTurnsBySql}
      ) as turnSequence
    FROM turns
    INNER JOIN sessions
      ON sessions.provider = turns.provider
      AND sessions.session_id = turns.session_id
    LEFT JOIN turn_usage
      ON turn_usage.provider = turns.provider
      AND turn_usage.session_id = turns.session_id
      AND turn_usage.turn_id = turns.turn_id
    WHERE sessions.identity_state = 'canonical'
    ORDER BY
      turns.provider,
      turns.session_id,
      ${orderedTurnsBySql}
  `);
	const orderedToolEventStatement = database.query(`
    SELECT
      tool_events.provider,
      tool_events.session_id as sessionId,
      tool_events.turn_id as turnId,
      tool_events.tool_call_id as toolCallId,
      tool_events.status,
      tool_events.tool_name as toolName,
      tool_events.tool_kind as toolKind,
      tool_events.input_json as inputJson,
      tool_events.output_json as outputJson,
      tool_events.status_text as statusText,
      tool_events.outcome,
      tool_events.error_message as errorMessage,
      tool_events.started_at as startedAt,
      tool_events.completed_at as completedAt,
      tool_events.updated_at as updatedAt
    FROM tool_events
    INNER JOIN sessions
      ON sessions.provider = tool_events.provider
      AND sessions.session_id = tool_events.session_id
    WHERE sessions.identity_state = 'canonical'
    ORDER BY
      tool_events.provider,
      tool_events.session_id,
      tool_events.turn_id,
      ${orderedToolEventsBySql}
  `);

	return {
		listOrderedTurns(): OrderedAnalysisTurnInput[] {
			const toolEventsByTurn = groupToolEventsByTurn(
				orderedToolEventStatement.all() as OrderedAnalysisToolEventRow[],
			);

			return (orderedTurnStatement.all() as OrderedAnalysisTurnRow[]).map(
				(row) => {
					const turn = mapTurnRow(row);
					const usage = mapOrderedTurnUsageRow(row);
					const session = mapOrderedTurnSessionContext(row);

					return {
						turnSequence: row.turnSequence,
						session,
						turn,
						usage,
						toolEvents:
							toolEventsByTurn.get(
								createTurnKey(turn.provider, turn.sessionId, turn.turnId),
							) ?? [],
					};
				},
			);
		},
	};
}

function groupToolEventsByTurn(
	rows: readonly OrderedAnalysisToolEventRow[],
): Map<string, StoredToolEventRecord[]> {
	const groupedToolEvents = new Map<string, StoredToolEventRecord[]>();

	for (const row of rows) {
		const key = createTurnKey(row.provider, row.sessionId, row.turnId);
		const toolEvents = groupedToolEvents.get(key) ?? [];

		toolEvents.push(mapToolEventRow(row));
		groupedToolEvents.set(key, toolEvents);
	}

	return groupedToolEvents;
}

function mapOrderedTurnUsageRow(
	row: OrderedAnalysisTurnRow,
): OrderedAnalysisTurnInput["usage"] {
	if (row.inputTokens === null || row.outputTokens === null) {
		return undefined;
	}

	return mapTurnUsageRow({
		provider: row.provider,
		sessionId: row.sessionId,
		turnId: row.turnId,
		inputTokens: row.inputTokens,
		outputTokens: row.outputTokens,
		cachedInputTokens: row.cachedInputTokens,
		costUsd: row.costUsd,
		providerUsageJson: row.providerUsageJson,
		updatedAt: row.usageUpdatedAt ?? row.updatedAt,
	} satisfies TurnUsageRow);
}

function createTurnKey(
	provider: string,
	sessionId: string,
	turnId: string,
): string {
	return `${provider}\u0000${sessionId}\u0000${turnId}`;
}
