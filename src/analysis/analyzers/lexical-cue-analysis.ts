import type { TurnFeatureAnalyzerSnapshot } from "../turn-feature-row";
import {
  countPatternMatches,
  normalizePromptForAnalysis,
} from "./prompt-normalization";

export type LexicalCueRule = {
  label: string;
  countKey: string;
  patterns: readonly RegExp[];
  reason: string;
};

export function analyzeLexicalCueRules(
  prompt: string,
  ruleIdPrefix: string,
  rules: readonly LexicalCueRule[],
): TurnFeatureAnalyzerSnapshot {
  const normalizedPrompt = normalizePromptForAnalysis(prompt);
  const counts = buildCounts(normalizedPrompt.text, rules);
  const matchedRules = rules.filter((rule) => counts[rule.countKey] > 0);

  return {
    applied: matchedRules.length > 0,
    labels: matchedRules.map((rule) => rule.label),
    ruleIds: matchedRules.map((rule) => `${ruleIdPrefix}:${rule.label}`),
    counts,
    reasons: matchedRules.map((rule) => rule.reason),
  };
}

function buildCounts(
  text: string,
  rules: readonly LexicalCueRule[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const rule of rules) {
    counts[rule.countKey] = countPatternMatches(text, rule.patterns);
  }

  return counts;
}
