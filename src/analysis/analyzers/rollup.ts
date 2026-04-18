import type { OrderedAnalysisTurnInput } from "../../storage";
import {
  TURN_FEATURE_SCORE_RANGE,
  type TurnFeatureAnalyzerSnapshot,
  type TurnFeatureAnalyzerSnapshots,
  type TurnFeatureDetail,
  type TurnFeatureEvidence,
  type TurnFeatureRollupSignals,
  type WriteReadyTurnFeatureRow,
} from "../turn-feature-row";

const DEFAULT_TRACE_RULE_IDS = ["rollup:base-fields"] as const;

export type BuildTurnFeatureRowOptions = Pick<
  WriteReadyTurnFeatureRow,
  "analyzedAt" | "featureVersion"
> & {
  signals?: TurnFeatureRollupSignals;
};

export function buildTurnFeatureRow(
  input: OrderedAnalysisTurnInput,
  options: BuildTurnFeatureRowOptions,
): WriteReadyTurnFeatureRow {
  const { turn, usage, toolEvents } = input;
  const prompt = turn.input?.prompt ?? "";
  const hasPrompt = prompt.trim().length > 0;
  const hasStructuredOutput = turn.output?.structuredOutput !== undefined;
  const hasError = turn.status === "failed" || turn.error !== undefined;
  const signals = options.signals;

  return {
    provider: turn.provider,
    sessionId: turn.sessionId,
    turnId: turn.turnId,
    featureVersion: options.featureVersion,
    analyzedAt: options.analyzedAt,
    turnSequence: input.turnSequence,
    turnStatus: turn.status,
    promptCharacterCount: prompt.length,
    attachmentCount: turn.input?.attachments?.length ?? 0,
    toolCallCount: toolEvents.length,
    hasStructuredOutput,
    hasError,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    cachedInputTokens: usage?.cachedInputTokens ?? null,
    costUsd: usage?.costUsd ?? null,
    detail: buildTurnFeatureDetail(signals),
    evidence: buildTurnFeatureEvidence(
      signals,
      hasPrompt,
      toolEvents,
      hasStructuredOutput,
      hasError,
    ),
  };
}

function buildTurnFeatureDetail(
  signals: TurnFeatureRollupSignals | undefined,
): TurnFeatureDetail {
  return {
    labels: stableUniqueStrings(signals?.labels),
    scores: {
      retry: clampTurnFeatureScore(signals?.retryScore),
      friction: clampTurnFeatureScore(signals?.frictionScore),
    },
    analyzers: buildAnalyzerSnapshots(signals?.analyzers),
  };
}

function buildTurnFeatureEvidence(
  signals: TurnFeatureRollupSignals | undefined,
  hasPrompt: boolean,
  toolEvents: OrderedAnalysisTurnInput["toolEvents"],
  hasStructuredOutput: boolean,
  hasError: boolean,
): TurnFeatureEvidence {
  return {
    eligibility: {
      reasons: stableUniqueStrings(
        signals?.eligibilityReasons ?? getDefaultEligibilityReasons(hasPrompt),
      ),
      hasPrompt,
      hasStructuredOutput,
      hasError,
    },
    trace: {
      ruleIds: stableUniqueStrings(signals?.ruleIds ?? DEFAULT_TRACE_RULE_IDS),
      priorTurnIds: stableUniqueStrings(signals?.priorTurnIds),
      toolCallIds: stableUniqueStrings(
        toolEvents.map((toolEvent) => toolEvent.toolCallId),
      ),
    },
  };
}

function buildAnalyzerSnapshots(
  analyzers: TurnFeatureRollupSignals["analyzers"],
): TurnFeatureAnalyzerSnapshots {
  return {
    textStructure: buildAnalyzerSnapshot(analyzers?.textStructure),
    correctionMarkers: buildAnalyzerSnapshot(analyzers?.correctionMarkers),
    workflowIntent: buildAnalyzerSnapshot(analyzers?.workflowIntent),
    frictionSignals: buildAnalyzerSnapshot(analyzers?.frictionSignals),
  };
}

function buildAnalyzerSnapshot(
  analyzer: Partial<TurnFeatureAnalyzerSnapshot> | undefined,
): TurnFeatureAnalyzerSnapshot {
  return {
    applied: analyzer?.applied ?? false,
    labels: stableUniqueStrings(analyzer?.labels),
    ruleIds: stableUniqueStrings(analyzer?.ruleIds),
  };
}

function clampTurnFeatureScore(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return TURN_FEATURE_SCORE_RANGE.min;
  }

  const roundedValue = Math.round(value);

  return Math.min(
    TURN_FEATURE_SCORE_RANGE.max,
    Math.max(TURN_FEATURE_SCORE_RANGE.min, roundedValue),
  );
}

function stableUniqueStrings(values: readonly string[] | undefined): string[] {
  if (!values) {
    return [];
  }

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

function getDefaultEligibilityReasons(hasPrompt: boolean): string[] {
  if (!hasPrompt) {
    return [];
  }

  return ["prompt-present"];
}

export type {
  TurnFeatureAnalyzerName,
  TurnFeatureAnalyzerSnapshot,
  TurnFeatureAnalyzerSnapshots,
  TurnFeatureDetail,
  TurnFeatureEvidence,
  TurnFeatureRollupSignals,
  WriteReadyTurnFeatureRow,
} from "../turn-feature-row";
