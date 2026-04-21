import type { StorageTurnKey } from "./schema";
import { STORAGE_PROVIDER_IDS } from "./schema";

export type WorkflowSearchDocumentKey = StorageTurnKey & {
	featureVersion: number;
};

export type StoredWorkflowSearchDocumentRecord = WorkflowSearchDocumentKey & {
	promptText: string;
	normalizedPromptText?: string;
	threadName?: string;
	projectPath?: string;
	tags: string[];
	workflowIntentLabels: string[];
	exactFingerprint?: string;
	nearFingerprint?: string;
	searchText: string;
	updatedAt: string;
};

export type SearchWorkflowSearchDocumentsInput = {
	featureVersion: number;
	queryText: string;
	limit?: number;
};

export type SearchedWorkflowSearchDocumentRecord =
	StoredWorkflowSearchDocumentRecord & {
		ftsScore: number;
	};

export type StoreWorkflowSearchDocumentInput = WorkflowSearchDocumentKey & {
	promptText: string;
	normalizedPromptText?: string;
	threadName?: string;
	projectPath?: string;
	tags: readonly string[];
	workflowIntentLabels: readonly string[];
	exactFingerprint?: string;
	nearFingerprint?: string;
	searchText: string;
	updatedAt?: string;
};

const providerValues = quotedValues(STORAGE_PROVIDER_IDS);

export const WORKFLOW_SEARCH_STORAGE_STATEMENTS = [
	`
        CREATE TABLE turn_search_documents (
          provider TEXT NOT NULL CHECK (provider IN (${providerValues})),
          session_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          feature_version INTEGER NOT NULL CHECK (feature_version >= 1),
          prompt_text TEXT NOT NULL,
          normalized_prompt_text TEXT,
          thread_name TEXT,
          project_path TEXT,
          tags_json TEXT NOT NULL CHECK (json_valid(tags_json)),
          workflow_intent_labels_json TEXT NOT NULL CHECK (json_valid(workflow_intent_labels_json)),
          exact_fingerprint TEXT,
          near_fingerprint TEXT,
          search_text TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, session_id, turn_id, feature_version),
          FOREIGN KEY (provider, session_id, turn_id, feature_version)
            REFERENCES turn_features(provider, session_id, turn_id, feature_version)
            ON DELETE CASCADE
        );
      `,
	`
        CREATE INDEX turn_search_documents_feature_version_idx
        ON turn_search_documents (feature_version, provider, session_id, turn_id);
      `,
	`
        CREATE INDEX turn_search_documents_exact_fingerprint_idx
        ON turn_search_documents (feature_version, exact_fingerprint);
      `,
	`
        CREATE INDEX turn_search_documents_near_fingerprint_idx
        ON turn_search_documents (feature_version, near_fingerprint);
      `,
	`
        CREATE VIRTUAL TABLE turn_search_documents_fts USING fts5(
          prompt_text,
          normalized_prompt_text,
          thread_name,
          project_path,
          tags_json,
          workflow_intent_labels_json,
          search_text,
          content='turn_search_documents',
          content_rowid='rowid',
          tokenize='unicode61'
        );
      `,
	`
        CREATE TRIGGER turn_search_documents_ai AFTER INSERT ON turn_search_documents BEGIN
          INSERT INTO turn_search_documents_fts (
            rowid,
            prompt_text,
            normalized_prompt_text,
            thread_name,
            project_path,
            tags_json,
            workflow_intent_labels_json,
            search_text
          ) VALUES (
            new.rowid,
            new.prompt_text,
            new.normalized_prompt_text,
            new.thread_name,
            new.project_path,
            new.tags_json,
            new.workflow_intent_labels_json,
            new.search_text
          );
        END;
      `,
	`
        CREATE TRIGGER turn_search_documents_ad AFTER DELETE ON turn_search_documents BEGIN
          INSERT INTO turn_search_documents_fts (
            turn_search_documents_fts,
            rowid,
            prompt_text,
            normalized_prompt_text,
            thread_name,
            project_path,
            tags_json,
            workflow_intent_labels_json,
            search_text
          ) VALUES (
            'delete',
            old.rowid,
            old.prompt_text,
            old.normalized_prompt_text,
            old.thread_name,
            old.project_path,
            old.tags_json,
            old.workflow_intent_labels_json,
            old.search_text
          );
        END;
      `,
	`
        CREATE TRIGGER turn_search_documents_au AFTER UPDATE ON turn_search_documents BEGIN
          INSERT INTO turn_search_documents_fts (
            turn_search_documents_fts,
            rowid,
            prompt_text,
            normalized_prompt_text,
            thread_name,
            project_path,
            tags_json,
            workflow_intent_labels_json,
            search_text
          ) VALUES (
            'delete',
            old.rowid,
            old.prompt_text,
            old.normalized_prompt_text,
            old.thread_name,
            old.project_path,
            old.tags_json,
            old.workflow_intent_labels_json,
            old.search_text
          );
          INSERT INTO turn_search_documents_fts (
            rowid,
            prompt_text,
            normalized_prompt_text,
            thread_name,
            project_path,
            tags_json,
            workflow_intent_labels_json,
            search_text
          ) VALUES (
            new.rowid,
            new.prompt_text,
            new.normalized_prompt_text,
            new.thread_name,
            new.project_path,
            new.tags_json,
            new.workflow_intent_labels_json,
            new.search_text
          );
        END;
      `,
] as const;

function quotedValues(values: readonly string[]): string {
	return values.map((value) => `'${value}'`).join(", ");
}
