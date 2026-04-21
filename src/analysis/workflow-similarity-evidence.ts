import { buildNearCanonicalPromptText } from "./near-prompt-canonical-text";
import {
  sanitizeWorkflowSearchTerm,
  sanitizeWorkflowSearchTerms,
} from "./workflow-search-text";
import type {
  WorkflowSimilarityContextSignal,
  WorkflowSimilarityEvidence,
  WorkflowSimilarityEvidenceInput,
  WorkflowSimilarityFingerprintMatch,
} from "./workflow-similarity-evidence-contract";

const PROMPT_EVIDENCE_PLACEHOLDERS = new Set([
  "senseipathplaceholder",
  "senseiticketplaceholder",
  "senseinumberplaceholder",
]);

export function buildWorkflowSimilarityEvidence(
  left: WorkflowSimilarityEvidenceInput,
  right: WorkflowSimilarityEvidenceInput,
): WorkflowSimilarityEvidence | undefined {
  const evidence = {
    fingerprintMatches: buildFingerprintMatches(left, right),
    sharedPromptTokens: intersectStable(
      buildPromptEvidenceTokens(left.promptText),
      buildPromptEvidenceTokens(right.promptText),
    ),
    sharedTags: intersectStable(
      sanitizeWorkflowSearchTerms(left.tags),
      sanitizeWorkflowSearchTerms(right.tags),
    ),
    sharedWorkflowIntentLabels: intersectStable(
      sanitizeWorkflowSearchTerms(left.workflowIntentLabels),
      sanitizeWorkflowSearchTerms(right.workflowIntentLabels),
    ),
    sharedContextSignals: buildSharedContextSignals(left, right),
  } satisfies WorkflowSimilarityEvidence;

  return hasWorkflowSimilarityEvidence(evidence) ? evidence : undefined;
}

function buildFingerprintMatches(
  left: WorkflowSimilarityEvidenceInput,
  right: WorkflowSimilarityEvidenceInput,
): WorkflowSimilarityFingerprintMatch[] {
  const matches: WorkflowSimilarityFingerprintMatch[] = [];
  pushSharedFingerprintMatch(matches, "exact", left.exactFingerprint, right.exactFingerprint);
  pushSharedFingerprintMatch(matches, "near", left.nearFingerprint, right.nearFingerprint);

  return matches;
}

function buildPromptEvidenceTokens(promptText: string): string[] {
  const nearCanonicalPromptText = buildNearCanonicalPromptText(promptText);

  if (nearCanonicalPromptText === undefined) {
    return [];
  }

  return stableUniqueStrings(
    nearCanonicalPromptText
      .split(" ")
      .filter(
        (token) =>
          token.length > 0 &&
          PROMPT_EVIDENCE_PLACEHOLDERS.has(token) === false,
      ),
  );
}

function buildSharedContextSignals(
  left: WorkflowSimilarityEvidenceInput,
  right: WorkflowSimilarityEvidenceInput,
): WorkflowSimilarityContextSignal[] {
  const signals: WorkflowSimilarityContextSignal[] = [];
  pushSharedContextSignal(signals, "thread-name", left.threadName, right.threadName);
  pushSharedContextSignal(signals, "project-path", left.projectPath, right.projectPath);

  return signals;
}

function getSharedString(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  const leftValue = sanitizeWorkflowSearchTerm(left);
  const rightValue = sanitizeWorkflowSearchTerm(right);

  return leftValue !== undefined && leftValue === rightValue ? leftValue : undefined;
}

function intersectStable(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightValues = new Set(stableUniqueStrings(right));

  return stableUniqueStrings(left).filter((value) => rightValues.has(value));
}

function hasWorkflowSimilarityEvidence(
  evidence: WorkflowSimilarityEvidence,
): boolean {
  return (
    evidence.fingerprintMatches.length > 0 ||
    evidence.sharedPromptTokens.length > 0 ||
    evidence.sharedTags.length > 0 ||
    evidence.sharedWorkflowIntentLabels.length > 0 ||
    evidence.sharedContextSignals.length > 0
  );
}

function pushSharedFingerprintMatch(
  matches: WorkflowSimilarityFingerprintMatch[],
  kind: WorkflowSimilarityFingerprintMatch["kind"],
  left: string | undefined,
  right: string | undefined,
): void {
  if (left === undefined || left !== right) {
    return;
  }

  matches.push({
    kind,
    fingerprint: left,
  });
}

function pushSharedContextSignal(
  signals: WorkflowSimilarityContextSignal[],
  kind: WorkflowSimilarityContextSignal["kind"],
  left: string | undefined,
  right: string | undefined,
): void {
  const sharedValue = getSharedString(left, right);

  if (sharedValue === undefined) {
    return;
  }

  signals.push({
    kind,
    value: sharedValue,
  });
}

function stableUniqueStrings(values: readonly string[]): string[] {
  const uniqueValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}
