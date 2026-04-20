import type { Database } from "bun:sqlite";

import type {
	StoreTurnFeatureInput,
	StoredTurnFeatureRecord,
} from "../turn-feature-schema";
import { parseJson, serializeJson } from "./shared";

export type TurnFeatureRepository = ReturnType<
	typeof createTurnFeatureRepository
>;

type TurnFeatureRow = {
	provider: string;
	sessionId: string;
	turnId: string;
	featureVersion: number;
	analyzedAt: string;
	turnSequence: number;
	turnStatus: string;
	promptCharacterCount: number;
	attachmentCount: number;
	toolCallCount: number;
	hasStructuredOutput: number;
	hasError: number;
	inputTokens: number | null;
	outputTokens: number | null;
	cachedInputTokens: number | null;
	costUsd: number | null;
	detailJson: string;
	evidenceJson: string;
};

type CreateTurnFeatureRepositoryOptions = {
	available?: boolean;
};

export function createTurnFeatureRepository(
	database: Database,
	options: CreateTurnFeatureRepositoryOptions = {},
) {
	if (options.available === false) {
		return createUnavailableTurnFeatureRepository();
	}

	const turnFeatureProjection = `
    provider,
    session_id as sessionId,
    turn_id as turnId,
    feature_version as featureVersion,
    analyzed_at as analyzedAt,
    turn_sequence as turnSequence,
    turn_status as turnStatus,
    prompt_character_count as promptCharacterCount,
    attachment_count as attachmentCount,
    tool_call_count as toolCallCount,
    has_structured_output as hasStructuredOutput,
    has_error as hasError,
    input_tokens as inputTokens,
    output_tokens as outputTokens,
    cached_input_tokens as cachedInputTokens,
    cost_usd as costUsd,
    detail_json as detailJson,
    evidence_json as evidenceJson
  `;
	const selectAllStatement = database.query(`
    SELECT
      ${turnFeatureProjection}
    FROM turn_features
    ORDER BY
      provider,
      session_id,
      feature_version,
      turn_sequence,
      turn_id
  `);
	const upsertTurnFeatureStatement = database.query(`
    INSERT INTO turn_features (
      provider,
      session_id,
      turn_id,
      feature_version,
      analyzed_at,
      turn_sequence,
      turn_status,
      prompt_character_count,
      attachment_count,
      tool_call_count,
      has_structured_output,
      has_error,
      input_tokens,
      output_tokens,
      cached_input_tokens,
      cost_usd,
      detail_json,
      evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, session_id, turn_id, feature_version) DO UPDATE SET
      analyzed_at = excluded.analyzed_at,
      turn_sequence = excluded.turn_sequence,
      turn_status = excluded.turn_status,
      prompt_character_count = excluded.prompt_character_count,
      attachment_count = excluded.attachment_count,
      tool_call_count = excluded.tool_call_count,
      has_structured_output = excluded.has_structured_output,
      has_error = excluded.has_error,
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      cached_input_tokens = excluded.cached_input_tokens,
      cost_usd = excluded.cost_usd,
      detail_json = excluded.detail_json,
      evidence_json = excluded.evidence_json
    RETURNING
      ${turnFeatureProjection}
  `);
	const deleteFeatureVersionStatement = database.query(`
    DELETE FROM turn_features
    WHERE feature_version = ?
  `);
	const upsertTurnFeature = (input: StoreTurnFeatureInput) =>
		mapTurnFeatureRow(
			upsertTurnFeatureStatement.get(
				...turnFeatureStatementParams(input),
			) as TurnFeatureRow,
		);

	return {
		listAll(): StoredTurnFeatureRecord[] {
			return (selectAllStatement.all() as TurnFeatureRow[]).map(
				mapTurnFeatureRow,
			);
		},
		replaceFeatureVersion(
			featureVersion: number,
			inputs: readonly StoreTurnFeatureInput[],
		): StoredTurnFeatureRecord[] {
			assertFeatureVersionInputs(featureVersion, inputs);
			deleteFeatureVersionStatement.run(featureVersion);

			return inputs.map(upsertTurnFeature);
		},
		upsert(input: StoreTurnFeatureInput): StoredTurnFeatureRecord {
			return upsertTurnFeature(input);
		},
		upsertMany(
			inputs: readonly StoreTurnFeatureInput[],
		): StoredTurnFeatureRecord[] {
			return inputs.map(upsertTurnFeature);
		},
	};
}

function createUnavailableTurnFeatureRepository() {
	return {
		listAll(): StoredTurnFeatureRecord[] {
			return [];
		},
		replaceFeatureVersion(
			_featureVersion: number,
			_inputs: readonly StoreTurnFeatureInput[],
		): StoredTurnFeatureRecord[] {
			throw new Error(
				"turn_features is unavailable in this database; reopen without readonly to run migrations first.",
			);
		},
		upsert(_input: StoreTurnFeatureInput): StoredTurnFeatureRecord {
			throw new Error(
				"turn_features is unavailable in this database; reopen without readonly to run migrations first.",
			);
		},
		upsertMany(
			inputs: readonly StoreTurnFeatureInput[],
		): StoredTurnFeatureRecord[] {
			if (inputs.length === 0) {
				return [];
			}

			throw new Error(
				"turn_features is unavailable in this database; reopen without readonly to run migrations first.",
			);
		},
	};
}

function mapTurnFeatureRow(row: TurnFeatureRow): StoredTurnFeatureRecord {
	return {
		provider: row.provider as StoredTurnFeatureRecord["provider"],
		sessionId: row.sessionId,
		turnId: row.turnId,
		featureVersion: row.featureVersion,
		analyzedAt: row.analyzedAt,
		turnSequence: row.turnSequence,
		turnStatus: row.turnStatus as StoredTurnFeatureRecord["turnStatus"],
		promptCharacterCount: row.promptCharacterCount,
		attachmentCount: row.attachmentCount,
		toolCallCount: row.toolCallCount,
		hasStructuredOutput: row.hasStructuredOutput === 1,
		hasError: row.hasError === 1,
		inputTokens: row.inputTokens ?? undefined,
		outputTokens: row.outputTokens ?? undefined,
		cachedInputTokens: row.cachedInputTokens ?? undefined,
		costUsd: row.costUsd ?? undefined,
		detail: parseJson(row.detailJson),
		evidence: parseJson(row.evidenceJson),
	};
}

function assertFeatureVersionInputs(
	featureVersion: number,
	inputs: readonly StoreTurnFeatureInput[],
): void {
	for (const input of inputs) {
		if (input.featureVersion !== featureVersion) {
			throw new Error(
				`turn_features refresh expected feature version ${featureVersion}, received ${input.featureVersion} for ${input.provider}/${input.sessionId}/${input.turnId}.`,
			);
		}
	}
}

function turnFeatureStatementParams(input: StoreTurnFeatureInput) {
	return [
		input.provider,
		input.sessionId,
		input.turnId,
		input.featureVersion,
		input.analyzedAt,
		input.turnSequence,
		input.turnStatus,
		input.promptCharacterCount,
		input.attachmentCount,
		input.toolCallCount,
		input.hasStructuredOutput ? 1 : 0,
		input.hasError ? 1 : 0,
		input.inputTokens ?? null,
		input.outputTokens ?? null,
		input.cachedInputTokens ?? null,
		input.costUsd ?? null,
		serializeJson(input.detail),
		serializeJson(input.evidence),
	] as const;
}
