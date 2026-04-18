import type { OrderedAnalysisTurnInput } from "../storage";
import { buildTurnFeatureRow } from "./analyzers/rollup";
import { resolveAnalyzedAt } from "./analyzed-at";
import {
  CURRENT_TURN_FEATURE_VERSION,
  resolveTurnFeatureVersion,
  type TurnFeatureVersion,
} from "./feature-version";
import type { WriteReadyTurnFeatureRow } from "./turn-feature-row";

export const TURN_FEATURE_SKIP_REASONS = [
  "missing-prompt-input",
  "blank-prompt-input",
] as const;

export type TurnFeatureSkipReason = (typeof TURN_FEATURE_SKIP_REASONS)[number];

export type SkippedTurnFeatureExtraction = {
  provider: OrderedAnalysisTurnInput["turn"]["provider"];
  sessionId: string;
  turnId: string;
  turnSequence: number;
  reason: TurnFeatureSkipReason;
};

export type TurnFeatureExtractionOptions = {
  analyzedAt: string;
  featureVersion?: TurnFeatureVersion;
};

export type TurnFeatureExtractionResult = {
  featureVersion: TurnFeatureVersion;
  analyzedAt: string;
  rows: WriteReadyTurnFeatureRow[];
  skipped: SkippedTurnFeatureExtraction[];
  summary: {
    totalTurns: number;
    eligibleTurns: number;
    skippedTurns: number;
  };
};

type TurnFeatureEligibility =
  | { eligible: true }
  | { eligible: false; reason: TurnFeatureSkipReason };

export function extractTurnFeatures(
  orderedTurns: readonly OrderedAnalysisTurnInput[],
  options: TurnFeatureExtractionOptions,
): TurnFeatureExtractionResult {
  const featureVersion = resolveTurnFeatureVersion(
    options.featureVersion ?? CURRENT_TURN_FEATURE_VERSION,
  );
  const analyzedAt = resolveAnalyzedAt(options.analyzedAt);
  const rows: WriteReadyTurnFeatureRow[] = [];
  const skipped: SkippedTurnFeatureExtraction[] = [];

  for (const orderedTurn of orderedTurns) {
    const eligibility = getTurnFeatureEligibility(orderedTurn);

    if (eligibility.eligible === false) {
      skipped.push({
        provider: orderedTurn.turn.provider,
        sessionId: orderedTurn.turn.sessionId,
        turnId: orderedTurn.turn.turnId,
        turnSequence: orderedTurn.turnSequence,
        reason: eligibility.reason,
      });
      continue;
    }

    rows.push(
      buildTurnFeatureRow(orderedTurn, {
        analyzedAt,
        featureVersion,
      }),
    );
  }

  return {
    featureVersion,
    analyzedAt,
    rows,
    skipped,
    summary: {
      totalTurns: orderedTurns.length,
      eligibleTurns: rows.length,
      skippedTurns: skipped.length,
    },
  };
}

export function getTurnFeatureEligibility(
  orderedTurn: OrderedAnalysisTurnInput,
): TurnFeatureEligibility {
  const prompt = orderedTurn.turn.input?.prompt;

  if (prompt === undefined) {
    return {
      eligible: false,
      reason: "missing-prompt-input",
    };
  }

  if (prompt.trim().length === 0) {
    return {
      eligible: false,
      reason: "blank-prompt-input",
    };
  }

  return {
    eligible: true,
  };
}
export type { WriteReadyTurnFeatureRow } from "./turn-feature-row";
