import type { Database } from "bun:sqlite";

import type {
	StoredWorkflowSearchDocumentRecord,
	StoreWorkflowSearchDocumentInput,
} from "../workflow-search-schema";
import { nowIsoString, serializeJson } from "./shared";

export type WorkflowSearchRepository = ReturnType<
	typeof createWorkflowSearchRepository
>;

type WorkflowSearchRow = {
	provider: string;
	sessionId: string;
	turnId: string;
	featureVersion: number;
	promptText: string;
	normalizedPromptText: string | null;
	threadName: string | null;
	projectPath: string | null;
	tagsJson: string;
	workflowIntentLabelsJson: string;
	exactFingerprint: string | null;
	nearFingerprint: string | null;
	searchText: string;
	updatedAt: string;
};

type CreateWorkflowSearchRepositoryOptions = {
	available?: boolean;
};

export function createWorkflowSearchRepository(
	database: Database,
	options: CreateWorkflowSearchRepositoryOptions = {},
) {
	if (options.available === false) {
		return createUnavailableWorkflowSearchRepository();
	}

	const workflowSearchProjection = `
    provider,
    session_id as sessionId,
    turn_id as turnId,
    feature_version as featureVersion,
    prompt_text as promptText,
    normalized_prompt_text as normalizedPromptText,
    thread_name as threadName,
    project_path as projectPath,
    tags_json as tagsJson,
    workflow_intent_labels_json as workflowIntentLabelsJson,
    exact_fingerprint as exactFingerprint,
    near_fingerprint as nearFingerprint,
    search_text as searchText,
    updated_at as updatedAt
  `;
	const selectAllStatement = database.query(`
    SELECT
      ${workflowSearchProjection}
    FROM turn_search_documents
    ORDER BY
      feature_version,
      provider,
      session_id,
      turn_id
  `);
	const upsertWorkflowSearchStatement = database.query(`
    INSERT INTO turn_search_documents (
      provider,
      session_id,
      turn_id,
      feature_version,
      prompt_text,
      normalized_prompt_text,
      thread_name,
      project_path,
      tags_json,
      workflow_intent_labels_json,
      exact_fingerprint,
      near_fingerprint,
      search_text,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, session_id, turn_id, feature_version) DO UPDATE SET
      prompt_text = excluded.prompt_text,
      normalized_prompt_text = excluded.normalized_prompt_text,
      thread_name = excluded.thread_name,
      project_path = excluded.project_path,
      tags_json = excluded.tags_json,
      workflow_intent_labels_json = excluded.workflow_intent_labels_json,
      exact_fingerprint = excluded.exact_fingerprint,
      near_fingerprint = excluded.near_fingerprint,
      search_text = excluded.search_text,
      updated_at = excluded.updated_at
    RETURNING
      ${workflowSearchProjection}
  `);
	const deleteFeatureVersionStatement = database.query(`
    DELETE FROM turn_search_documents
    WHERE feature_version = ?
  `);
	const upsertWorkflowSearchDocument = (
		input: StoreWorkflowSearchDocumentInput,
	) =>
		mapWorkflowSearchRow(
			upsertWorkflowSearchStatement.get(
				...workflowSearchStatementParams(input),
			) as WorkflowSearchRow,
		);

	return {
		listAll(): StoredWorkflowSearchDocumentRecord[] {
			return (selectAllStatement.all() as WorkflowSearchRow[]).map(
				mapWorkflowSearchRow,
			);
		},
		replaceFeatureVersion(
			featureVersion: number,
			inputs: readonly StoreWorkflowSearchDocumentInput[],
		): StoredWorkflowSearchDocumentRecord[] {
			assertFeatureVersionInputs(featureVersion, inputs);
			deleteFeatureVersionStatement.run(featureVersion);

			return inputs.map(upsertWorkflowSearchDocument);
		},
		upsert(
			input: StoreWorkflowSearchDocumentInput,
		): StoredWorkflowSearchDocumentRecord {
			return upsertWorkflowSearchDocument(input);
		},
		upsertMany(
			inputs: readonly StoreWorkflowSearchDocumentInput[],
		): StoredWorkflowSearchDocumentRecord[] {
			return inputs.map(upsertWorkflowSearchDocument);
		},
	};
}

function createUnavailableWorkflowSearchRepository() {
	return {
		listAll(): StoredWorkflowSearchDocumentRecord[] {
			return [];
		},
		replaceFeatureVersion(
			_featureVersion: number,
			inputs: readonly StoreWorkflowSearchDocumentInput[],
		): StoredWorkflowSearchDocumentRecord[] {
			if (inputs.length === 0) {
				return [];
			}

			throw unavailableWorkflowSearchError();
		},
		upsert(
			_input: StoreWorkflowSearchDocumentInput,
		): StoredWorkflowSearchDocumentRecord {
			throw unavailableWorkflowSearchError();
		},
		upsertMany(
			inputs: readonly StoreWorkflowSearchDocumentInput[],
		): StoredWorkflowSearchDocumentRecord[] {
			if (inputs.length === 0) {
				return [];
			}

			throw unavailableWorkflowSearchError();
		},
	};
}

function mapWorkflowSearchRow(
	row: WorkflowSearchRow,
): StoredWorkflowSearchDocumentRecord {
	return {
		provider: row.provider as StoredWorkflowSearchDocumentRecord["provider"],
		sessionId: row.sessionId,
		turnId: row.turnId,
		featureVersion: row.featureVersion,
		promptText: row.promptText,
		normalizedPromptText: row.normalizedPromptText ?? undefined,
		threadName: row.threadName ?? undefined,
		projectPath: row.projectPath ?? undefined,
		tags: parseStringArray(row.tagsJson),
		workflowIntentLabels: parseStringArray(row.workflowIntentLabelsJson),
		exactFingerprint: row.exactFingerprint ?? undefined,
		nearFingerprint: row.nearFingerprint ?? undefined,
		searchText: row.searchText,
		updatedAt: row.updatedAt,
	};
}

function assertFeatureVersionInputs(
	featureVersion: number,
	inputs: readonly StoreWorkflowSearchDocumentInput[],
): void {
	for (const input of inputs) {
		if (input.featureVersion !== featureVersion) {
			throw new Error(
				`turn_search_documents refresh expected feature version ${featureVersion}, received ${input.featureVersion} for ${input.provider}/${input.sessionId}/${input.turnId}.`,
			);
		}
	}
}

function workflowSearchStatementParams(
	input: StoreWorkflowSearchDocumentInput,
) {
	return [
		input.provider,
		input.sessionId,
		input.turnId,
		input.featureVersion,
		input.promptText,
		input.normalizedPromptText ?? null,
		input.threadName ?? null,
		input.projectPath ?? null,
		serializeJson([...input.tags]),
		serializeJson([...input.workflowIntentLabels]),
		input.exactFingerprint ?? null,
		input.nearFingerprint ?? null,
		input.searchText,
		input.updatedAt ?? nowIsoString(),
	] as const;
}

function parseStringArray(value: string): string[] {
	const parsed = JSON.parse(value);

	if (Array.isArray(parsed) === false) {
		return [];
	}

	return parsed.filter((entry): entry is string => typeof entry === "string");
}

function unavailableWorkflowSearchError(): Error {
	return new Error(
		"turn_search_documents is unavailable in this database; reopen without readonly to run migrations first.",
	);
}
