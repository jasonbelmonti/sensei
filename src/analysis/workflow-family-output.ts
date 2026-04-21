import type {
	StoreWorkflowFamilyInput,
	StoreWorkflowFamilyMemberInput,
	StoreWorkflowSearchDocumentInput,
} from "../storage";
import type { WorkflowSimilarityEvidence } from "./workflow-similarity-evidence-contract";

export type WorkflowFamilySourceRow = StoreWorkflowSearchDocumentInput;

export type WorkflowFamilyClusterResult = {
	families: StoreWorkflowFamilyInput[];
	members: StoreWorkflowFamilyMemberInput[];
};

export type WorkflowFamilyMergeReason =
	| "exact-fingerprint"
	| "project-path-scope"
	| "near-fingerprint"
	| "workflow-intent-overlap"
	| "project-path-overlap"
	| "thread-name-overlap";

export type ExactWorkflowFamilyGroup = {
	key: string;
	featureVersion: number;
	exactFingerprint?: string;
	nearFingerprint?: string;
	projectPath?: string;
	rows: WorkflowFamilySourceRow[];
	anchor: WorkflowFamilySourceRow;
	tags: string[];
	workflowIntentLabels: string[];
	threadNames: string[];
	projectPaths: string[];
};

export type WorkflowFamilyMergeDecision = {
	addedGroupKey: string;
	reasons: WorkflowFamilyMergeReason[];
	similarityEvidence: WorkflowSimilarityEvidence;
};

export type WorkflowFamilyCluster = {
	seedGroup: ExactWorkflowFamilyGroup;
	exactGroups: ExactWorkflowFamilyGroup[];
	mergeDecisions: WorkflowFamilyMergeDecision[];
	sharedTags: string[];
	sharedWorkflowIntentLabels: string[];
	sharedProjectPaths: string[];
	sharedThreadNames: string[];
};

export type WorkflowFamilyRecordEvidence = {
	seedGroupKey: string;
	exactGroupKeys: string[];
	exactGroupCount: number;
	familySize: number;
	mergeReasons: WorkflowFamilyMergeReason[];
	sharedTags: string[];
	sharedWorkflowIntentLabels: string[];
	sharedProjectPaths: string[];
	sharedThreadNames: string[];
	mergeDecisions: WorkflowFamilyMergeDecision[];
};

export type WorkflowFamilyMemberRecordEvidence = {
	exactGroupKey: string;
	relation: "seed-exact" | "exact-rerun" | "near-merged";
	mergeReasons: WorkflowFamilyMergeReason[];
};
