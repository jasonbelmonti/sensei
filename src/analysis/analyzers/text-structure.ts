import type { TurnFeatureAnalyzerSnapshot } from "../turn-feature-row";
import {
  isQuestionLikeLine,
  normalizePromptForAnalysis,
} from "./prompt-normalization";

export function analyzeTextStructure(prompt: string): TurnFeatureAnalyzerSnapshot {
  const normalizedPrompt = normalizePromptForAnalysis(prompt);

  if (normalizedPrompt.lineCount === 0) {
    return {
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
    };
  }

  const labels = [
    normalizedPrompt.lineCount > 1 ? "multi-line" : "single-line",
    ...(normalizedPrompt.bulletLineCount > 0 ? ["bullet-list"] : []),
    ...(normalizedPrompt.numberedLineCount > 0 ? ["numbered-list"] : []),
    ...(normalizedPrompt.codeFenceCount > 0 ? ["code-fence"] : []),
    ...(isQuestionLed(normalizedPrompt)
      ? ["question-led"]
      : []),
    ...(normalizedPrompt.headingLineCount > 0 ? ["heading-style"] : []),
  ];

  return {
    applied: true,
    labels,
    ruleIds: labels.map((label) => `text-structure:${label}`),
    counts: {
      lineCount: normalizedPrompt.lineCount,
      bulletLineCount: normalizedPrompt.bulletLineCount,
      numberedLineCount: normalizedPrompt.numberedLineCount,
      codeFenceCount: normalizedPrompt.codeFenceCount,
      questionLineCount: normalizedPrompt.questionLineCount,
    },
    reasons: buildReasons(normalizedPrompt, labels),
  };
}

function isQuestionLed(
  normalizedPrompt: ReturnType<typeof normalizePromptForAnalysis>,
): boolean {
  const firstLine = normalizedPrompt.lines[0];

  if (!firstLine) {
    return false;
  }

  return isQuestionLikeLine(firstLine);
}

function buildReasons(
  normalizedPrompt: ReturnType<typeof normalizePromptForAnalysis>,
  labels: readonly string[],
): string[] {
  const reasons = [
    normalizedPrompt.lineCount > 1
      ? "detected multiple non-empty lines"
      : "detected a single non-empty line",
  ];

  for (const label of labels) {
    switch (label) {
      case "bullet-list":
        reasons.push("detected markdown-style bullet lines");
        break;
      case "numbered-list":
        reasons.push("detected numbered instruction lines");
        break;
      case "code-fence":
        reasons.push("detected fenced code markers");
        break;
      case "question-led":
        reasons.push("detected a question-led opening line");
        break;
      case "heading-style":
        reasons.push("detected heading-style line formatting");
        break;
      default:
        break;
    }
  }

  return reasons;
}
