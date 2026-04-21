import type {
	SearchedWorkflowSearchDocumentRecord,
	StoredWorkflowSearchDocumentRecord,
} from "../workflow-search-schema";

export type WorkflowSearchRow = {
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

export type SearchedWorkflowSearchRow = WorkflowSearchRow & {
	ftsScore: number;
};

export function createWorkflowSearchProjection(tableName?: string): string {
	return workflowSearchProjectionColumns
		.map(({ column, alias }) => `${qualifyColumn(tableName, column)} as ${alias}`)
		.join(",\n    ");
}

export function mapWorkflowSearchRow(
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

export function mapSearchedWorkflowSearchRow(
	row: SearchedWorkflowSearchRow,
): SearchedWorkflowSearchDocumentRecord {
	return {
		...mapWorkflowSearchRow(row),
		ftsScore: row.ftsScore,
	};
}

function parseStringArray(value: string): string[] {
	const parsed = JSON.parse(value);

	if (Array.isArray(parsed) === false) {
		return [];
	}

	return parsed.filter((entry): entry is string => typeof entry === "string");
}

function qualifyColumn(tableName: string | undefined, column: string): string {
	return tableName ? `${tableName}.${column}` : column;
}

const workflowSearchProjectionColumns = [
	{ column: "provider", alias: "provider" },
	{ column: "session_id", alias: "sessionId" },
	{ column: "turn_id", alias: "turnId" },
	{ column: "feature_version", alias: "featureVersion" },
	{ column: "prompt_text", alias: "promptText" },
	{ column: "normalized_prompt_text", alias: "normalizedPromptText" },
	{ column: "thread_name", alias: "threadName" },
	{ column: "project_path", alias: "projectPath" },
	{ column: "tags_json", alias: "tagsJson" },
	{
		column: "workflow_intent_labels_json",
		alias: "workflowIntentLabelsJson",
	},
	{ column: "exact_fingerprint", alias: "exactFingerprint" },
	{ column: "near_fingerprint", alias: "nearFingerprint" },
	{ column: "search_text", alias: "searchText" },
	{ column: "updated_at", alias: "updatedAt" },
] as const;
