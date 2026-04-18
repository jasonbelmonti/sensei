import type { TurnFeatureAnalyzerSnapshot, TurnFeatureRollupSignals } from "../turn-feature-row";
import { analyzeCorrectionMarkers } from "./correction-markers";
import { analyzeTextStructure } from "./text-structure";
import { analyzeWorkflowIntent } from "./workflow-intent";

const ANALYZER_LABEL_PREFIXES = {
  textStructure: "text-structure",
  correctionMarkers: "correction-markers",
  workflowIntent: "workflow-intent",
} as const;

type PromptSemanticAnalyzerKey = keyof typeof ANALYZER_LABEL_PREFIXES;

export function buildPromptSemanticSignals(
  prompt: string,
): TurnFeatureRollupSignals {
  const analyzers = {
    textStructure: analyzeTextStructure(prompt),
    correctionMarkers: analyzeCorrectionMarkers(prompt),
    workflowIntent: analyzeWorkflowIntent(prompt),
  };

  return {
    labels: buildPromptSemanticLabels(analyzers),
    ruleIds: buildPromptSemanticRuleIds(analyzers),
    analyzers,
  };
}

function buildPromptSemanticLabels(
  analyzers: Record<PromptSemanticAnalyzerKey, TurnFeatureAnalyzerSnapshot>,
): string[] {
  return stableUniqueStrings(
    (Object.keys(ANALYZER_LABEL_PREFIXES) as PromptSemanticAnalyzerKey[]).flatMap(
      (key) =>
        analyzers[key].labels.map(
          (label) => `${ANALYZER_LABEL_PREFIXES[key]}:${label}`,
        ),
    ),
  );
}

function buildPromptSemanticRuleIds(
  analyzers: Record<PromptSemanticAnalyzerKey, TurnFeatureAnalyzerSnapshot>,
): string[] {
  return stableUniqueStrings(
    Object.values(analyzers).flatMap((analyzer) => analyzer.ruleIds),
  );
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
