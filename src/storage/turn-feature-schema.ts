import type { StorageTurnKey, StorageTurnStatus } from "./schema";
import {
	STORAGE_PROVIDER_IDS,
	STORAGE_TURN_STATUSES,
	type StorageMigrationDefinition,
} from "./schema";

export type StorageTurnFeatureKey = StorageTurnKey & {
	featureVersion: number;
};

export type StoredTurnFeatureRecord = StorageTurnFeatureKey & {
	analyzedAt: string;
	turnSequence: number;
	turnStatus: StorageTurnStatus;
	promptCharacterCount: number;
	attachmentCount: number;
	toolCallCount: number;
	hasStructuredOutput: boolean;
	hasError: boolean;
	inputTokens?: number;
	outputTokens?: number;
	cachedInputTokens?: number;
	costUsd?: number;
	detail: unknown;
	evidence: unknown;
};

export type StoreTurnFeatureInput = StorageTurnFeatureKey & {
	analyzedAt: string;
	turnSequence: number;
	turnStatus: StorageTurnStatus;
	promptCharacterCount: number;
	attachmentCount: number;
	toolCallCount: number;
	hasStructuredOutput: boolean;
	hasError: boolean;
	inputTokens?: number | null;
	outputTokens?: number | null;
	cachedInputTokens?: number | null;
	costUsd?: number | null;
	detail: unknown;
	evidence: unknown;
};

const providerValues = quotedValues(STORAGE_PROVIDER_IDS);
const turnStatusValues = quotedValues(STORAGE_TURN_STATUSES);

export const TURN_FEATURE_STORAGE_MIGRATION = {
	id: "0002_turn_features",
	statements: [
		`
        CREATE TABLE turn_features (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          feature_version INTEGER NOT NULL CHECK (feature_version >= 1),
          analyzed_at TEXT NOT NULL,
          turn_sequence INTEGER NOT NULL CHECK (turn_sequence >= 1),
          turn_status TEXT NOT NULL CHECK (turn_status IN (${turnStatusValues})),
          prompt_character_count INTEGER NOT NULL CHECK (prompt_character_count >= 0),
          attachment_count INTEGER NOT NULL CHECK (attachment_count >= 0),
          tool_call_count INTEGER NOT NULL CHECK (tool_call_count >= 0),
          has_structured_output INTEGER NOT NULL CHECK (has_structured_output IN (0, 1)),
          has_error INTEGER NOT NULL CHECK (has_error IN (0, 1)),
          input_tokens INTEGER,
          output_tokens INTEGER,
          cached_input_tokens INTEGER,
          cost_usd REAL,
          detail_json TEXT NOT NULL CHECK (json_valid(detail_json)),
          evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
          PRIMARY KEY (provider, session_id, turn_id, feature_version),
          FOREIGN KEY (provider, session_id, turn_id)
            REFERENCES turns(provider, session_id, turn_id)
            ON DELETE CASCADE
        );
      `,
		`
        CREATE INDEX turn_features_session_version_turn_sequence_idx
        ON turn_features (provider, session_id, feature_version, turn_sequence);
      `,
		`
        CREATE INDEX turn_features_provider_version_status_idx
        ON turn_features (provider, feature_version, turn_status);
      `,
	],
} as const satisfies StorageMigrationDefinition;

function quotedValues(values: readonly string[]): string {
	return values.map((value) => `'${value}'`).join(", ");
}
