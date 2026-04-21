import type { OrderedAnalysisTurnInput } from "../storage";

import type {
  WorkflowSearchSourceTurnFeature,
  WriteReadyWorkflowSearchRow,
} from "./workflow-search-row";
import { buildExactPromptFingerprint } from "./exact-prompt-fingerprint";
import { buildNearPromptFingerprint } from "./near-prompt-fingerprint";
import {
  buildWorkflowSearchText,
  normalizeWorkflowSearchPromptText,
  sanitizeWorkflowSearchTerm,
  sanitizeWorkflowSearchTerms,
} from "./workflow-search-text";

export function buildWorkflowSearchRow(
  orderedTurn: OrderedAnalysisTurnInput,
  sourceTurnFeature: WorkflowSearchSourceTurnFeature,
): WriteReadyWorkflowSearchRow | undefined {
  const promptText = getWorkflowSearchPromptText(orderedTurn);

  if (promptText === undefined) {
    return undefined;
  }

  const normalizedPromptText = normalizeWorkflowSearchPromptText(promptText);
  const exactFingerprint = buildExactPromptFingerprint(promptText);
  const nearFingerprint = buildNearPromptFingerprint(promptText);
  const tags = sanitizeWorkflowSearchTerms(orderedTurn.session.tags);
  const workflowIntentLabels = getWorkflowIntentLabels(sourceTurnFeature.detail);

  return {
    provider: orderedTurn.turn.provider,
    sessionId: orderedTurn.turn.sessionId,
    turnId: orderedTurn.turn.turnId,
    featureVersion: sourceTurnFeature.featureVersion,
    promptText,
    normalizedPromptText:
      normalizedPromptText.length > 0 ? normalizedPromptText : undefined,
    exactFingerprint,
    nearFingerprint,
    threadName: sanitizeWorkflowSearchTerm(orderedTurn.session.threadName),
    projectPath: sanitizeWorkflowSearchTerm(
      orderedTurn.session.workingDirectory,
    ),
    tags,
    workflowIntentLabels,
    searchText: buildWorkflowSearchText({
      promptText,
      threadName: orderedTurn.session.threadName,
      projectPath: orderedTurn.session.workingDirectory,
      tags,
      workflowIntentLabels,
    }),
    updatedAt: sourceTurnFeature.analyzedAt,
  };
}

function getWorkflowSearchPromptText(
  orderedTurn: OrderedAnalysisTurnInput,
): string | undefined {
  const promptText = orderedTurn.turn.input?.prompt;

  if (promptText === undefined || promptText.trim().length === 0) {
    return undefined;
  }

  return promptText;
}

function getWorkflowIntentLabels(detail: unknown): string[] {
  if (isObjectRecord(detail) === false) {
    return [];
  }

  const analyzers = detail.analyzers;

  if (isObjectRecord(analyzers) === false) {
    return [];
  }

  const workflowIntent = analyzers.workflowIntent;

  if (isObjectRecord(workflowIntent) === false) {
    return [];
  }

  return sanitizeWorkflowSearchTerms(workflowIntent.labels);
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
