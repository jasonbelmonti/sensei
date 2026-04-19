import { expect, test } from "bun:test";

import {
  buildTurnFeatureRollupRow,
  buildTurnFeatureRow,
  CURRENT_TURN_FEATURE_VERSION,
  TURN_FEATURE_SCORE_RANGE,
} from "../../src/analysis";
import { createOrderedTurnInput } from "./ordered-analysis-turn-fixture";

const FIXED_ANALYZED_AT = "2026-04-18T19:45:00.000Z";

test("rollup composes prompt and friction analyzers into one deterministic row", () => {
  const prompt = "Debug the repeated tool failures.";
  const row = buildTurnFeatureRollupRow(
    createOrderedTurnInput({
      turnSequence: 6,
      turnId: "turn-rollup-composed",
      prompt,
      toolEvents: [
        {
          toolCallId: "tool-6a",
          status: "completed",
          toolName: "exec_command",
          outcome: "success",
        },
        {
          toolCallId: "tool-6b",
          status: "completed",
          toolName: "exec_command",
          outcome: "cancelled",
        },
      ],
    }),
    {
      analyzedAt: FIXED_ANALYZED_AT,
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
      priorTurns: [
        createOrderedTurnInput({
          turnSequence: 5,
          turnId: "turn-rollup-prior-failed",
          prompt: "Retry after the failed turn.",
          status: "failed",
          error: {
            code: "timeout",
            message: "tool call timed out",
          },
        }),
      ],
    },
  );

  expect(row.detail.labels).toEqual([
    "text-structure:single-line",
    "correction-markers:fix-cue",
    "workflow-intent:debug",
    "friction-signals:prior-turn-retry",
    "friction-signals:tool-failure",
    "friction-signals:repeated-tool",
  ]);
  expect(row.detail.scores).toEqual({
    retry: 1,
    friction: 2,
  });
  expect(row.evidence.trace).toEqual({
    ruleIds: [
      "rollup:base-fields",
      "text-structure:single-line",
      "correction-markers:fix-cue",
      "workflow-intent:debug",
      "friction-signals:prior-turn-retry",
      "friction-signals:tool-failure",
      "friction-signals:repeated-tool",
    ],
    priorTurnIds: ["turn-rollup-prior-failed"],
    toolCallIds: ["tool-6a", "tool-6b"],
  });

  const serializedRow = JSON.stringify(row);

  expect(JSON.parse(serializedRow)).toEqual(row);
  expect(serializedRow).not.toContain(prompt);
});

test("rollup derives prompt evidence from the turn payload", () => {
  const row = buildTurnFeatureRow(
    createOrderedTurnInput({
      turnSequence: 7,
      turnId: "turn-direct-rollup-no-prompt",
    }),
    {
      analyzedAt: FIXED_ANALYZED_AT,
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
    },
  );

  expect(row.promptCharacterCount).toBe(0);
  expect(row.evidence.eligibility).toEqual({
    reasons: [],
    hasPrompt: false,
    hasStructuredOutput: false,
    hasError: false,
  });
});

test("rollup guards non-finite analyzer scores before clamping", () => {
  const row = buildTurnFeatureRow(
    createOrderedTurnInput({
      turnSequence: 8,
      turnId: "turn-direct-rollup-invalid-scores",
      prompt: "Explain the score guard behavior.",
    }),
    {
      analyzedAt: FIXED_ANALYZED_AT,
      featureVersion: CURRENT_TURN_FEATURE_VERSION,
      signals: {
        retryScore: Number.NaN,
        frictionScore: Number.POSITIVE_INFINITY,
      },
    },
  );

  expect(row.detail.scores).toEqual({
    retry: TURN_FEATURE_SCORE_RANGE.min,
    friction: TURN_FEATURE_SCORE_RANGE.min,
  });
});

test("rollup rejects invalid feature version values", () => {
  expect(() =>
    buildTurnFeatureRow(
      createOrderedTurnInput({
        turnSequence: 9,
        turnId: "turn-direct-rollup-invalid-version",
        prompt: "Explain invalid version handling.",
      }),
      {
        analyzedAt: FIXED_ANALYZED_AT,
        featureVersion: 0,
      },
    ),
  ).toThrow("Turn feature version must be a positive integer.");
});

test("rollup rejects blank analyzed timestamps", () => {
  expect(() =>
    buildTurnFeatureRow(
      createOrderedTurnInput({
        turnSequence: 10,
        turnId: "turn-direct-rollup-blank-analyzed-at",
        prompt: "Explain analyzedAt validation.",
      }),
      {
        analyzedAt: "   ",
        featureVersion: CURRENT_TURN_FEATURE_VERSION,
      },
    ),
  ).toThrow("analyzedAt must be a non-empty timestamp string.");
});
