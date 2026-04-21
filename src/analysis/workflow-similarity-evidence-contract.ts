import type { WriteReadyWorkflowSearchRow } from "./workflow-search-row";

export type WorkflowSimilarityEvidenceInput = Pick<
  WriteReadyWorkflowSearchRow,
  | "promptText"
  | "threadName"
  | "projectPath"
  | "tags"
  | "workflowIntentLabels"
  | "exactFingerprint"
  | "nearFingerprint"
>;

export type WorkflowSimilarityFingerprintMatch = {
  kind: "exact" | "near";
  fingerprint: string;
};

export type WorkflowSimilarityContextSignal = {
  kind: "thread-name" | "project-path";
  value: string;
};

export type WorkflowSimilarityEvidence = {
  fingerprintMatches: WorkflowSimilarityFingerprintMatch[];
  sharedPromptTokens: string[];
  sharedTags: string[];
  sharedWorkflowIntentLabels: string[];
  sharedContextSignals: WorkflowSimilarityContextSignal[];
};
