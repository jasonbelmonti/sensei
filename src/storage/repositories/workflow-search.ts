import type { Database } from "bun:sqlite";

import type {
	SearchedWorkflowSearchDocumentRecord,
	SearchWorkflowSearchDocumentsInput,
	StoredWorkflowSearchDocumentRecord,
	StoreWorkflowSearchDocumentInput,
} from "../workflow-search-schema";
import {
	buildWorkflowSearchMatchQuery,
	resolveWorkflowSearchLimit,
} from "./workflow-search-query";
import {
	createWorkflowSearchProjection,
	mapSearchedWorkflowSearchRow,
	mapWorkflowSearchRow,
	type SearchedWorkflowSearchRow,
	type WorkflowSearchRow,
} from "./workflow-search-records";
import { nowIsoString, serializeJson } from "./shared";

export type WorkflowSearchRepository = ReturnType<
	typeof createWorkflowSearchRepository
>;

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

	const workflowSearchProjection = createWorkflowSearchProjection();
	const qualifiedWorkflowSearchProjection =
		createWorkflowSearchProjection("turn_search_documents");
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
	const searchStatement = database.query(`
    SELECT
      ${qualifiedWorkflowSearchProjection},
      bm25(turn_search_documents_fts) as ftsScore
    FROM turn_search_documents_fts
    INNER JOIN turn_search_documents
      ON turn_search_documents.rowid = turn_search_documents_fts.rowid
    WHERE
      turn_search_documents.feature_version = ?
      AND turn_search_documents_fts MATCH ?
    ORDER BY
      ftsScore,
      turn_search_documents.provider,
      turn_search_documents.session_id,
      turn_search_documents.turn_id
    LIMIT ?
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
	const replaceFeatureVersionTransaction = database.transaction(
		(
			featureVersion: number,
			inputs: readonly StoreWorkflowSearchDocumentInput[],
		) => {
			deleteFeatureVersionStatement.run(featureVersion);

			return inputs.map(upsertWorkflowSearchDocument);
		},
	);

	return {
		listAll(): StoredWorkflowSearchDocumentRecord[] {
			return (selectAllStatement.all() as WorkflowSearchRow[]).map(
				mapWorkflowSearchRow,
			);
		},
		search(
			input: SearchWorkflowSearchDocumentsInput,
		): SearchedWorkflowSearchDocumentRecord[] {
			const matchQuery = buildWorkflowSearchMatchQuery(input.queryText);

			if (matchQuery === undefined) {
				return [];
			}

			return (searchStatement.all(
				input.featureVersion,
				matchQuery,
				resolveWorkflowSearchLimit(input.limit),
			) as SearchedWorkflowSearchRow[]).map(mapSearchedWorkflowSearchRow);
		},
		replaceFeatureVersion(
			featureVersion: number,
			inputs: readonly StoreWorkflowSearchDocumentInput[],
		): StoredWorkflowSearchDocumentRecord[] {
			assertFeatureVersionInputs(featureVersion, inputs);

			return replaceFeatureVersionTransaction(featureVersion, inputs);
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
		search(
			_input: SearchWorkflowSearchDocumentsInput,
		): SearchedWorkflowSearchDocumentRecord[] {
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

function unavailableWorkflowSearchError(): Error {
	return new Error(
		"turn_search_documents is unavailable in this database; reopen without readonly to run migrations first.",
	);
}
