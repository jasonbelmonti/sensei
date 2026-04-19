import type { OrderedAnalysisTurnInput } from "../storage";
import { buildTurnFeatureRow } from "./analyzers/rollup";
import { resolveAnalyzedAt } from "./analyzed-at";
import {
  CURRENT_TURN_FEATURE_VERSION,
  resolveTurnFeatureVersion,
  type TurnFeatureVersion,
} from "./feature-version";
import { buildTurnFeatureSignals } from "./turn-feature-signals";
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
  const priorTurnsBySession = new Map<string, OrderedAnalysisTurnInput[]>();

  for (const orderedTurn of orderedTurns) {
    const eligibility = getTurnFeatureEligibility(orderedTurn);
    const sessionKey = getAnalysisSessionKey(orderedTurn);
    const priorTurns = getOrCreateSessionTurns(priorTurnsBySession, sessionKey);

    if (eligibility.eligible === false) {
      skipped.push({
        provider: orderedTurn.turn.provider,
        sessionId: orderedTurn.turn.sessionId,
        turnId: orderedTurn.turn.turnId,
        turnSequence: orderedTurn.turnSequence,
        reason: eligibility.reason,
      });
      priorTurns.push(orderedTurn);
      continue;
    }

    const signals = buildTurnFeatureSignals(orderedTurn, {
      priorTurns,
    });

    rows.push(
      buildTurnFeatureRow(orderedTurn, {
        analyzedAt,
        featureVersion,
        signals,
      }),
    );

    priorTurns.push(orderedTurn);
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

function getAnalysisSessionKey(orderedTurn: OrderedAnalysisTurnInput): string {
  return `${orderedTurn.turn.provider}:${orderedTurn.turn.sessionId}`;
}

function getOrCreateSessionTurns(
  priorTurnsBySession: Map<string, OrderedAnalysisTurnInput[]>,
  sessionKey: string,
): OrderedAnalysisTurnInput[] {
  const existingTurns = priorTurnsBySession.get(sessionKey);

  if (existingTurns) {
    return existingTurns;
  }

  const sessionTurns: OrderedAnalysisTurnInput[] = [];
  priorTurnsBySession.set(sessionKey, sessionTurns);

  return sessionTurns;
}
export type { WriteReadyTurnFeatureRow } from "./turn-feature-row";
