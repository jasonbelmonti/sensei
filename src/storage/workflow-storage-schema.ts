import type { StorageMigrationDefinition } from "./schema";
import { WORKFLOW_FAMILY_STORAGE_STATEMENTS } from "./workflow-family-schema";
import { WORKFLOW_SEARCH_STORAGE_STATEMENTS } from "./workflow-search-schema";

export type {
	StoredWorkflowFamilyMemberRecord,
	StoredWorkflowFamilyRecord,
	StoreWorkflowFamilyInput,
	StoreWorkflowFamilyMemberInput,
	WorkflowFamilyKey,
	WorkflowFamilyMemberKey,
} from "./workflow-family-schema";
export type {
	StoredWorkflowSearchDocumentRecord,
	StoreWorkflowSearchDocumentInput,
	WorkflowSearchDocumentKey,
} from "./workflow-search-schema";

export const WORKFLOW_STORAGE_MIGRATION = {
	id: "0003_workflow_storage",
	statements: [
		...WORKFLOW_SEARCH_STORAGE_STATEMENTS,
		...WORKFLOW_FAMILY_STORAGE_STATEMENTS,
	],
} as const satisfies StorageMigrationDefinition;
