import { expect, test } from "bun:test";

import {
  CURRENT_TURN_FEATURE_VERSION,
  deriveWorkflowSearchRows,
  extractTurnFeatures,
} from "../../src/analysis";
import { createOrderedTurnInput } from "./ordered-analysis-turn-fixture";

const FIXED_ANALYZED_AT = "2026-04-19T02:00:00.000Z";

test("workflow search derivation returns one ordered row per eligible analyzed turn and leaves fingerprints unset", () => {
  const orderedTurns = [
    createOrderedTurnInput({
      turnSequence: 1,
      turnId: "turn-001",
      prompt: "Explain the BEL-806 workflow storage foundation.",
      session: {
        threadName: "BEL-806 derivation",
        workingDirectory: "/repo/sensei",
        tags: ["analysis", "bel-806", "analysis"],
      },
    }),
    createOrderedTurnInput({
      turnSequence: 2,
      turnId: "turn-002",
      prompt: "Plan the BEL-807 retrieval follow-up.",
      session: {
        threadName: "BEL-806 derivation",
        workingDirectory: "/repo/sensei",
        tags: ["analysis", "bel-806"],
      },
    }),
    createOrderedTurnInput({
      turnSequence: 3,
      turnId: "turn-003",
      prompt: "   ",
      session: {
        threadName: "BEL-806 derivation",
        workingDirectory: "/repo/sensei",
        tags: ["analysis", "bel-806"],
      },
    }),
  ];
  const extraction = extractTurnFeatures(orderedTurns, {
    analyzedAt: FIXED_ANALYZED_AT,
  });

  const rows = deriveWorkflowSearchRows(orderedTurns, [
    extraction.rows[1],
    extraction.rows[0],
  ]);

  expect(extraction.summary).toEqual({
    totalTurns: 3,
    eligibleTurns: 2,
    skippedTurns: 1,
  });
  expect(rows).toEqual([
    {
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-001",
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
      promptText: "Explain the BEL-806 workflow storage foundation.",
      normalizedPromptText: "explain the bel 806 workflow storage foundation",
      threadName: "BEL-806 derivation",
      projectPath: "/repo/sensei",
      tags: ["analysis", "bel-806"],
      workflowIntentLabels: ["explain"],
      searchText:
        "Explain the BEL-806 workflow storage foundation. BEL-806 derivation /repo/sensei analysis bel-806 explain",
      updatedAt: FIXED_ANALYZED_AT,
    },
    {
      provider: "codex",
      sessionId: "session-1",
      turnId: "turn-002",
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
      promptText: "Plan the BEL-807 retrieval follow-up.",
      normalizedPromptText: "plan the bel 807 retrieval follow up",
      threadName: "BEL-806 derivation",
      projectPath: "/repo/sensei",
      tags: ["analysis", "bel-806"],
      workflowIntentLabels: ["plan"],
      searchText:
        "Plan the BEL-807 retrieval follow-up. BEL-806 derivation /repo/sensei analysis bel-806 plan",
      updatedAt: FIXED_ANALYZED_AT,
    },
  ]);
});
