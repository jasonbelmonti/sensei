import type { Database } from "bun:sqlite";

import type {
  StoreSessionInput,
  StoredSessionRecord,
  StoreToolEventInput,
  StoredToolEventRecord,
  StoreTurnInput,
  StoredTurnRecord,
  StoreTurnUsageInput,
  StoredTurnUsageRecord,
} from "../schema";
import {
  mapSessionRow,
  mapToolEventRow,
  mapTurnRow,
  mapTurnUsageRow,
  mergeSessionRecord,
  mergeToolEventRecord,
  mergeTurnRecord,
  mergeTurnUsageRecord,
  sessionStatementParams,
  type SessionRow,
  toolEventStatementParams,
  type ToolEventRow,
  turnStatementParams,
  type TurnRow,
  turnUsageStatementParams,
  type TurnUsageRow,
} from "./conversation-records";

export type ConversationRepository = ReturnType<typeof createConversationRepository>;

export function createConversationRepository(database: Database) {
  const incomingTurnStatusRankExpression = `
    CASE excluded.status
      WHEN 'started' THEN 0
      WHEN 'failed' THEN 1
      WHEN 'completed' THEN 2
      ELSE -1
    END
  `;
  const storedTurnStatusRankExpression = `
    CASE turns.status
      WHEN 'started' THEN 0
      WHEN 'failed' THEN 1
      WHEN 'completed' THEN 2
      ELSE -1
    END
  `;
  const shouldReplaceTurnPayloadExpression = `
    ${incomingTurnStatusRankExpression} >= ${storedTurnStatusRankExpression}
  `;
  const effectiveTurnStatusExpression = `
    CASE
      WHEN ${shouldReplaceTurnPayloadExpression}
        THEN excluded.status
      ELSE turns.status
    END
  `;
  const selectSessionStatement = database.query(`
    SELECT
      provider,
      session_id as sessionId,
      identity_state as identityState,
      working_directory as workingDirectory,
      session_metadata_json as metadataJson,
      source_provider as sourceProvider,
      source_kind as sourceKind,
      discovery_phase as sourceDiscoveryPhase,
      source_root_path as sourceRootPath,
      source_file_path as sourceFilePath,
      source_line as sourceLine,
      source_byte_offset as sourceByteOffset,
      source_metadata_json as sourceMetadataJson,
      completeness,
      observation_reason as observationReason,
      observed_at as observedAt,
      updated_at as updatedAt
    FROM sessions
    WHERE provider = ? AND session_id = ?
  `);
  const upsertSessionStatement = database.query(`
    INSERT INTO sessions (
      provider,
      session_id,
      identity_state,
      working_directory,
      session_metadata_json,
      source_provider,
      source_kind,
      discovery_phase,
      source_root_path,
      source_file_path,
      source_line,
      source_byte_offset,
      source_metadata_json,
      completeness,
      observation_reason,
      observed_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, session_id) DO UPDATE SET
      identity_state = excluded.identity_state,
      working_directory = excluded.working_directory,
      session_metadata_json = excluded.session_metadata_json,
      source_provider = excluded.source_provider,
      source_kind = excluded.source_kind,
      discovery_phase = excluded.discovery_phase,
      source_root_path = excluded.source_root_path,
      source_file_path = excluded.source_file_path,
      source_line = excluded.source_line,
      source_byte_offset = excluded.source_byte_offset,
      source_metadata_json = excluded.source_metadata_json,
      completeness = excluded.completeness,
      observation_reason = excluded.observation_reason,
      observed_at = excluded.observed_at,
      updated_at = excluded.updated_at
  `);
  const selectTurnStatement = database.query(`
    SELECT
      provider,
      session_id as sessionId,
      turn_id as turnId,
      status,
      input_prompt as inputPrompt,
      input_attachments_json as inputAttachmentsJson,
      input_metadata_json as inputMetadataJson,
      output_text as outputText,
      output_structured_output_json as outputStructuredOutputJson,
      stop_reason as stopReason,
      error_code as errorCode,
      error_message as errorMessage,
      error_details_json as errorDetailsJson,
      raw_event_json as rawEventJson,
      extensions_json as extensionsJson,
      started_at as startedAt,
      completed_at as completedAt,
      failed_at as failedAt,
      updated_at as updatedAt
    FROM turns
    WHERE provider = ? AND session_id = ? AND turn_id = ?
  `);
  const upsertTurnStatement = database.query(`
    INSERT INTO turns (
      provider,
      session_id,
      turn_id,
      status,
      input_prompt,
      input_attachments_json,
      input_metadata_json,
      output_text,
      output_structured_output_json,
      stop_reason,
      error_code,
      error_message,
      error_details_json,
      raw_event_json,
      extensions_json,
      started_at,
      completed_at,
      failed_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, session_id, turn_id) DO UPDATE SET
      status = ${effectiveTurnStatusExpression},
      input_prompt = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.input_prompt, turns.input_prompt)
        ELSE turns.input_prompt
      END,
      input_attachments_json = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.input_attachments_json, turns.input_attachments_json)
        ELSE turns.input_attachments_json
      END,
      input_metadata_json = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.input_metadata_json, turns.input_metadata_json)
        ELSE turns.input_metadata_json
      END,
      output_text = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.output_text, turns.output_text)
        ELSE turns.output_text
      END,
      output_structured_output_json = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(
            excluded.output_structured_output_json,
            turns.output_structured_output_json
          )
        ELSE turns.output_structured_output_json
      END,
      stop_reason = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.stop_reason, turns.stop_reason)
        ELSE turns.stop_reason
      END,
      error_code = CASE
        WHEN ${effectiveTurnStatusExpression} = 'completed' THEN NULL
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.error_code, turns.error_code)
        ELSE turns.error_code
      END,
      error_message = CASE
        WHEN ${effectiveTurnStatusExpression} = 'completed' THEN NULL
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.error_message, turns.error_message)
        ELSE turns.error_message
      END,
      error_details_json = CASE
        WHEN ${effectiveTurnStatusExpression} = 'completed' THEN NULL
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.error_details_json, turns.error_details_json)
        ELSE turns.error_details_json
      END,
      raw_event_json = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.raw_event_json, turns.raw_event_json)
        ELSE turns.raw_event_json
      END,
      extensions_json = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.extensions_json, turns.extensions_json)
        ELSE turns.extensions_json
      END,
      started_at = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.started_at, turns.started_at)
        ELSE turns.started_at
      END,
      completed_at = CASE
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.completed_at, turns.completed_at)
        ELSE turns.completed_at
      END,
      failed_at = CASE
        WHEN ${effectiveTurnStatusExpression} = 'completed' THEN NULL
        WHEN ${shouldReplaceTurnPayloadExpression}
          THEN COALESCE(excluded.failed_at, turns.failed_at)
        ELSE turns.failed_at
      END,
      updated_at = excluded.updated_at
  `);
  const selectTurnUsageStatement = database.query(`
    SELECT
      provider,
      session_id as sessionId,
      turn_id as turnId,
      input_tokens as inputTokens,
      output_tokens as outputTokens,
      cached_input_tokens as cachedInputTokens,
      cost_usd as costUsd,
      provider_usage_json as providerUsageJson,
      updated_at as updatedAt
    FROM turn_usage
    WHERE provider = ? AND session_id = ? AND turn_id = ?
  `);
  const upsertTurnUsageStatement = database.query(`
    INSERT INTO turn_usage (
      provider,
      session_id,
      turn_id,
      input_tokens,
      output_tokens,
      cached_input_tokens,
      cost_usd,
      provider_usage_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, session_id, turn_id) DO UPDATE SET
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      cached_input_tokens = excluded.cached_input_tokens,
      cost_usd = excluded.cost_usd,
      provider_usage_json = excluded.provider_usage_json,
      updated_at = excluded.updated_at
  `);
  const selectToolEventStatement = database.query(`
    SELECT
      provider,
      session_id as sessionId,
      turn_id as turnId,
      tool_call_id as toolCallId,
      status,
      tool_name as toolName,
      tool_kind as toolKind,
      input_json as inputJson,
      output_json as outputJson,
      status_text as statusText,
      outcome,
      error_message as errorMessage,
      started_at as startedAt,
      completed_at as completedAt,
      updated_at as updatedAt
    FROM tool_events
    WHERE provider = ? AND session_id = ? AND turn_id = ? AND tool_call_id = ?
  `);
  const listToolEventsStatement = database.query(`
    SELECT
      provider,
      session_id as sessionId,
      turn_id as turnId,
      tool_call_id as toolCallId,
      status,
      tool_name as toolName,
      tool_kind as toolKind,
      input_json as inputJson,
      output_json as outputJson,
      status_text as statusText,
      outcome,
      error_message as errorMessage,
      started_at as startedAt,
      completed_at as completedAt,
      updated_at as updatedAt
    FROM tool_events
    WHERE provider = ? AND session_id = ? AND turn_id = ?
    ORDER BY tool_call_id
  `);
  const upsertToolEventStatement = database.query(`
    INSERT INTO tool_events (
      provider,
      session_id,
      turn_id,
      tool_call_id,
      status,
      tool_name,
      tool_kind,
      input_json,
      output_json,
      status_text,
      outcome,
      error_message,
      started_at,
      completed_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, session_id, turn_id, tool_call_id) DO UPDATE SET
      status = excluded.status,
      tool_name = excluded.tool_name,
      tool_kind = excluded.tool_kind,
      input_json = excluded.input_json,
      output_json = excluded.output_json,
      status_text = excluded.status_text,
      outcome = excluded.outcome,
      error_message = excluded.error_message,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at
  `);

  function getSession(provider: StoreSessionInput["provider"], sessionId: string) {
    const row = selectSessionStatement.get(provider, sessionId) as SessionRow | null;
    return row ? mapSessionRow(row) : null;
  }

  function getTurn(
    provider: StoreTurnInput["provider"],
    sessionId: string,
    turnId: string,
  ) {
    const row = selectTurnStatement.get(provider, sessionId, turnId) as TurnRow | null;
    return row ? mapTurnRow(row) : null;
  }

  function getTurnUsage(
    provider: StoreTurnUsageInput["provider"],
    sessionId: string,
    turnId: string,
  ) {
    const row = selectTurnUsageStatement.get(
      provider,
      sessionId,
      turnId,
    ) as TurnUsageRow | null;
    return row ? mapTurnUsageRow(row) : null;
  }

  function getToolEvent(
    provider: StoreToolEventInput["provider"],
    sessionId: string,
    turnId: string,
    toolCallId: string,
  ) {
    const row = selectToolEventStatement.get(
      provider,
      sessionId,
      turnId,
      toolCallId,
    ) as ToolEventRow | null;
    return row ? mapToolEventRow(row) : null;
  }

  function listToolEvents(
    provider: StoreToolEventInput["provider"],
    sessionId: string,
    turnId: string,
  ) {
    return (listToolEventsStatement.all(
      provider,
      sessionId,
      turnId,
    ) as ToolEventRow[]).map(mapToolEventRow);
  }

  return {
    getSession,
    upsertSession(input: StoreSessionInput): StoredSessionRecord {
      const existing = getSession(input.provider, input.sessionId);
      const merged = mergeSessionRecord(existing, input);
      upsertSessionStatement.run(...sessionStatementParams(merged));

      return merged;
    },
    getTurn,
    upsertTurn(input: StoreTurnInput): StoredTurnRecord {
      const candidateTurn = mergeTurnRecord(null, input);
      upsertTurnStatement.run(...turnStatementParams(candidateTurn));

      const storedTurn = getTurn(input.provider, input.sessionId, input.turnId);

      if (storedTurn === null) {
        throw new Error("Turn write succeeded but no row was returned.");
      }

      return storedTurn;
    },
    getTurnUsage,
    upsertTurnUsage(input: StoreTurnUsageInput): StoredTurnUsageRecord {
      const merged = mergeTurnUsageRecord(
        getTurnUsage(input.provider, input.sessionId, input.turnId),
        input,
      );
      upsertTurnUsageStatement.run(...turnUsageStatementParams(merged));

      return merged;
    },
    getToolEvent,
    listToolEvents,
    upsertToolEvent(input: StoreToolEventInput): StoredToolEventRecord {
      const existing = getToolEvent(
        input.provider,
        input.sessionId,
        input.turnId,
        input.toolCallId,
      );
      const merged = mergeToolEventRecord(existing, input);
      upsertToolEventStatement.run(...toolEventStatementParams(merged));

      return merged;
    },
  };
}
