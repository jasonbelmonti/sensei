import { expect, test } from "bun:test";

import {
  buildExactPromptFingerprint,
  buildNearPromptFingerprint,
  buildWorkflowSimilarityEvidence,
} from "../../src/analysis";
import type { WorkflowSimilarityEvidenceInput } from "../../src/analysis";

test("workflow similarity evidence returns explicit fingerprint, prompt token, tag, intent, and context matches for exact-equivalent prompts", () => {
  const leftPromptText =
    "Explain the BEL-820 workflow storage foundation in /repo/sensei before 2026-04-21.";
  const rightPromptText =
    "  explain THE bel 820 workflow storage foundation in /repo/sensei before 2026 04 21  ";
  const leftExactFingerprint = requireFingerprint(
    buildExactPromptFingerprint(leftPromptText),
    "expected exact fingerprint for non-empty prompt text",
  );
  const leftNearFingerprint = requireFingerprint(
    buildNearPromptFingerprint(leftPromptText),
    "expected near fingerprint for non-empty prompt text",
  );

  const evidence = buildWorkflowSimilarityEvidence(
    createEvidenceInput({
      promptText: leftPromptText,
      threadName: "BEL-820 evidence",
      projectPath: "/repo/sensei",
      tags: ["analysis", "stable", "bel-820", "analysis"],
      workflowIntentLabels: ["explain", "document", "explain"],
    }),
    createEvidenceInput({
      promptText: rightPromptText,
      threadName: "BEL-820 evidence",
      projectPath: "/repo/sensei",
      tags: ["stable", "analysis", "follow-up"],
      workflowIntentLabels: ["document", "explain", "plan"],
    }),
  );

  expect(evidence).toEqual({
    fingerprintMatches: [
      {
        kind: "exact",
        fingerprint: leftExactFingerprint,
      },
      {
        kind: "near",
        fingerprint: leftNearFingerprint,
      },
    ],
    sharedPromptTokens: [
      "explain",
      "the",
      "bel",
      "workflow",
      "storage",
      "foundation",
      "in",
      "repo",
      "sensei",
      "before",
    ],
    sharedTags: ["analysis", "stable"],
    sharedWorkflowIntentLabels: ["explain", "document"],
    sharedContextSignals: [
      {
        kind: "thread-name",
        value: "BEL-820 evidence",
      },
      {
        kind: "project-path",
        value: "/repo/sensei",
      },
    ],
  });
});

test("workflow similarity evidence records a near-only fingerprint match without placeholder-only prompt token overlap", () => {
  const leftPromptText = "123 /Users/alice/code/sensei/.worktrees/bel-819";
  const rightPromptText = "456 /workspace/sensei/.worktrees/bel-820";
  const leftNearFingerprint = requireFingerprint(
    buildNearPromptFingerprint(leftPromptText),
    "expected near fingerprint for placeholder-only near match",
  );

  const evidence = buildWorkflowSimilarityEvidence(
    createEvidenceInput({
      promptText: leftPromptText,
      threadName: "BEL-820 evidence",
      projectPath: "/repo/sensei",
      tags: ["analysis", "triage", "analysis"],
      workflowIntentLabels: ["plan", "research"],
    }),
    createEvidenceInput({
      promptText: rightPromptText,
      threadName: "BEL-820 follow-up",
      projectPath: "/repo/sensei",
      tags: ["triage", "analysis", "next"],
      workflowIntentLabels: ["research", "plan", "implement"],
    }),
  );

  expect(evidence).toEqual({
    fingerprintMatches: [
      {
        kind: "near",
        fingerprint: leftNearFingerprint,
      },
    ],
    sharedPromptTokens: [],
    sharedTags: ["analysis", "triage"],
    sharedWorkflowIntentLabels: ["plan", "research"],
    sharedContextSignals: [
      {
        kind: "project-path",
        value: "/repo/sensei",
      },
    ],
  });
  expect(buildExactPromptFingerprint(leftPromptText)).not.toBe(
    buildExactPromptFingerprint(rightPromptText),
  );
});

test("workflow similarity evidence returns undefined when two inputs share no meaningful overlap", () => {
  const leftPromptText = "Alpha bravo charlie";
  const rightPromptText = "delta echo foxtrot";

  const evidence = buildWorkflowSimilarityEvidence(
    createEvidenceInput({
      promptText: leftPromptText,
      threadName: "thread-alpha",
      projectPath: "/repo/alpha",
      tags: ["left-tag"],
      workflowIntentLabels: ["explain"],
    }),
    createEvidenceInput({
      promptText: rightPromptText,
      threadName: "thread-delta",
      projectPath: "/repo/delta",
      tags: ["right-tag"],
      workflowIntentLabels: ["plan"],
    }),
  );

  expect(evidence).toBeUndefined();
});

function createEvidenceInput(
  input: Omit<
    WorkflowSimilarityEvidenceInput,
    "exactFingerprint" | "nearFingerprint"
  >,
): WorkflowSimilarityEvidenceInput {
  return {
    ...input,
    exactFingerprint: buildExactPromptFingerprint(input.promptText),
    nearFingerprint: buildNearPromptFingerprint(input.promptText),
  };
}

function requireFingerprint(
  fingerprint: string | undefined,
  message: string,
): string {
  if (fingerprint === undefined) {
    throw new Error(message);
  }

  return fingerprint;
}
