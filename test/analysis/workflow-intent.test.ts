import { expect, test } from "bun:test";

import {
  analyzeCorrectionMarkers,
  analyzeTextStructure,
  analyzeWorkflowIntent,
} from "../../src/analysis";

const EMPTY_WORKFLOW_COUNTS = {
  implement: 0,
  debug: 0,
  review: 0,
  plan: 0,
  explain: 0,
  refactor: 0,
  setup: 0,
  research: 0,
};

test("workflow intent analyzer covers the expected prompt families", () => {
  const fixtures = [
    {
      name: "implement",
      prompt: "Implement the analyzer module.",
      labels: ["implement"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, implement: 1 },
    },
    {
      name: "debug",
      prompt: "Debug the timeout error.",
      labels: ["debug"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, debug: 3 },
    },
    {
      name: "review",
      prompt: "Review the analyzer contract.",
      labels: ["review"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, review: 1 },
    },
    {
      name: "plan",
      prompt: "Plan the next analyzer step.",
      labels: ["plan"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, plan: 1 },
    },
    {
      name: "explain",
      prompt: "Explain the analyzer contract.",
      labels: ["explain"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, explain: 1 },
    },
    {
      name: "refactor",
      prompt: "Refactor the analyzer module.",
      labels: ["refactor"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, refactor: 1 },
    },
    {
      name: "setup",
      prompt: "Setup the analyzer workspace.",
      labels: ["setup"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, setup: 1 },
    },
    {
      name: "research",
      prompt: "Research the available analyzer options.",
      labels: ["research"],
      counts: { ...EMPTY_WORKFLOW_COUNTS, research: 1 },
    },
    {
      name: "multi-intent",
      prompt: "Plan and implement the analyzer, then review the result.",
      labels: ["implement", "review", "plan"],
      counts: {
        ...EMPTY_WORKFLOW_COUNTS,
        implement: 1,
        review: 1,
        plan: 1,
      },
    },
    {
      name: "negative-control",
      prompt: "Need deterministic prompt semantics metadata.",
      labels: [],
      counts: EMPTY_WORKFLOW_COUNTS,
    },
  ];

  for (const fixture of fixtures) {
    const snapshot = analyzeWorkflowIntent(fixture.prompt);

    expect(snapshot.labels).toEqual(fixture.labels);
    expect(snapshot.counts).toEqual(fixture.counts);
    expect(snapshot.applied).toBe(fixture.labels.length > 0);
    expect(snapshot.ruleIds).toEqual(
      fixture.labels.map((label) => `workflow-intent:${label}`),
    );
    expect(snapshot.reasons).toEqual(
      fixture.labels.map((label) =>
        label === "plan"
          ? "matched planning intent lexical cues"
          : `matched ${label} intent lexical cues`,
      ),
    );
  }
});

test("text structure analyzer emits deterministic structural labels and counts", () => {
  expect(analyzeTextStructure("   ")).toEqual({
    applied: false,
    labels: [],
    ruleIds: [],
    counts: {
      lineCount: 0,
      bulletLineCount: 0,
      numberedLineCount: 0,
      codeFenceCount: 0,
      questionLineCount: 0,
    },
    reasons: [],
  });

  expect(analyzeTextStructure("Implement analyzer logic.")).toEqual({
    applied: true,
    labels: ["single-line"],
    ruleIds: ["text-structure:single-line"],
    counts: {
      lineCount: 1,
      bulletLineCount: 0,
      numberedLineCount: 0,
      codeFenceCount: 0,
      questionLineCount: 0,
    },
    reasons: ["detected a single non-empty line"],
  });

  expect(
    analyzeTextStructure("plan next steps\n- add analyzer\n- add tests"),
  ).toEqual({
    applied: true,
    labels: ["multi-line", "bullet-list"],
    ruleIds: ["text-structure:multi-line", "text-structure:bullet-list"],
    counts: {
      lineCount: 3,
      bulletLineCount: 2,
      numberedLineCount: 0,
      codeFenceCount: 0,
      questionLineCount: 0,
    },
    reasons: [
      "detected multiple non-empty lines",
      "detected markdown-style bullet lines",
    ],
  });

  expect(analyzeTextStructure("1. inspect\n2. patch")).toEqual({
    applied: true,
    labels: ["multi-line", "numbered-list"],
    ruleIds: ["text-structure:multi-line", "text-structure:numbered-list"],
    counts: {
      lineCount: 2,
      bulletLineCount: 0,
      numberedLineCount: 2,
      codeFenceCount: 0,
      questionLineCount: 0,
    },
    reasons: [
      "detected multiple non-empty lines",
      "detected numbered instruction lines",
    ],
  });

  expect(
    analyzeTextStructure("Use this snippet\n```ts\nconst value = 1;\n```"),
  ).toEqual({
    applied: true,
    labels: ["multi-line", "code-fence"],
    ruleIds: ["text-structure:multi-line", "text-structure:code-fence"],
    counts: {
      lineCount: 4,
      bulletLineCount: 0,
      numberedLineCount: 0,
      codeFenceCount: 2,
      questionLineCount: 0,
    },
    reasons: [
      "detected multiple non-empty lines",
      "detected fenced code markers",
    ],
  });

  expect(analyzeTextStructure("How does the analyzer decide intent?")).toEqual({
    applied: true,
    labels: ["single-line", "question-led"],
    ruleIds: ["text-structure:single-line", "text-structure:question-led"],
    counts: {
      lineCount: 1,
      bulletLineCount: 0,
      numberedLineCount: 0,
      codeFenceCount: 0,
      questionLineCount: 1,
    },
    reasons: [
      "detected a single non-empty line",
      "detected a question-led opening line",
    ],
  });

  expect(analyzeTextStructure("Why did the analyzer fail")).toEqual({
    applied: true,
    labels: ["single-line", "question-led"],
    ruleIds: ["text-structure:single-line", "text-structure:question-led"],
    counts: {
      lineCount: 1,
      bulletLineCount: 0,
      numberedLineCount: 0,
      codeFenceCount: 0,
      questionLineCount: 1,
    },
    reasons: [
      "detected a single non-empty line",
      "detected a question-led opening line",
    ],
  });

  expect(analyzeTextStructure("Overview:\nImplement analyzer heuristics.")).toEqual(
    {
      applied: true,
      labels: ["multi-line", "heading-style"],
      ruleIds: ["text-structure:multi-line", "text-structure:heading-style"],
      counts: {
        lineCount: 2,
        bulletLineCount: 0,
        numberedLineCount: 0,
        codeFenceCount: 0,
        questionLineCount: 0,
      },
      reasons: [
        "detected multiple non-empty lines",
        "detected heading-style line formatting",
      ],
    },
  );
});

test("correction marker analyzer emits deterministic marker counts", () => {
  expect(analyzeCorrectionMarkers("Fix and debug the analyzer.")).toEqual({
    applied: true,
    labels: ["fix-cue"],
    ruleIds: ["correction-markers:fix-cue"],
    counts: {
      fixCueCount: 2,
      failureCueCount: 0,
      replacementCueCount: 0,
      rollbackCueCount: 0,
      correctionCueCount: 0,
    },
    reasons: ["matched fix-oriented lexical cues"],
  });

  expect(
    analyzeCorrectionMarkers("The analyzer hit a timeout error bug."),
  ).toEqual({
    applied: true,
    labels: ["failure-cue"],
    ruleIds: ["correction-markers:failure-cue"],
    counts: {
      fixCueCount: 0,
      failureCueCount: 3,
      replacementCueCount: 0,
      rollbackCueCount: 0,
      correctionCueCount: 0,
    },
    reasons: ["matched failure-oriented lexical cues"],
  });

  expect(
    analyzeCorrectionMarkers("Replace this rule instead of change it later."),
  ).toEqual({
    applied: true,
    labels: ["replacement-cue"],
    ruleIds: ["correction-markers:replacement-cue"],
    counts: {
      fixCueCount: 0,
      failureCueCount: 0,
      replacementCueCount: 3,
      rollbackCueCount: 0,
      correctionCueCount: 0,
    },
    reasons: ["matched replacement-oriented lexical cues"],
  });

  expect(
    analyzeCorrectionMarkers("Revert the last patch and roll back the analyzer."),
  ).toEqual({
    applied: true,
    labels: ["rollback-cue"],
    ruleIds: ["correction-markers:rollback-cue"],
    counts: {
      fixCueCount: 0,
      failureCueCount: 0,
      replacementCueCount: 0,
      rollbackCueCount: 2,
      correctionCueCount: 0,
    },
    reasons: ["matched rollback-oriented lexical cues"],
  });

  expect(analyzeCorrectionMarkers("Correct the typo in the analyzer copy.")).toEqual(
    {
      applied: true,
      labels: ["correction-cue"],
      ruleIds: ["correction-markers:correction-cue"],
      counts: {
        fixCueCount: 0,
        failureCueCount: 0,
        replacementCueCount: 0,
        rollbackCueCount: 0,
        correctionCueCount: 2,
      },
      reasons: ["matched correction-oriented lexical cues"],
    },
  );

  expect(analyzeCorrectionMarkers("Implement analyzer metadata.")).toEqual({
    applied: false,
    labels: [],
    ruleIds: [],
    counts: {
      fixCueCount: 0,
      failureCueCount: 0,
      replacementCueCount: 0,
      rollbackCueCount: 0,
      correctionCueCount: 0,
    },
    reasons: [],
  });
});
