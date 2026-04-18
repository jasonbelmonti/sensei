import type { OrderedAnalysisTurnInput, StorageTurnStatus } from "../storage";
import type { TurnFeatureVersion } from "./feature-version";

export const TURN_FEATURE_SCORE_RANGE = {
  min: 0,
  max: 3,
} as const;

export type TurnFeatureAnalyzerName =
  | "textStructure"
  | "correctionMarkers"
  | "workflowIntent"
  | "frictionSignals";

export type TurnFeatureAnalyzerSnapshot = {
  applied: boolean;
  labels: string[];
  ruleIds: string[];
};

export type TurnFeatureAnalyzerSnapshots = Record<
  TurnFeatureAnalyzerName,
  TurnFeatureAnalyzerSnapshot
>;

export type TurnFeatureDetail = {
  labels: string[];
  scores: {
    retry: number;
    friction: number;
  };
  analyzers: TurnFeatureAnalyzerSnapshots;
};

export type TurnFeatureEvidence = {
  eligibility: {
    reasons: string[];
    hasPrompt: boolean;
    hasStructuredOutput: boolean;
    hasError: boolean;
  };
  trace: {
    ruleIds: string[];
    priorTurnIds: string[];
    toolCallIds: string[];
  };
};

export type WriteReadyTurnFeatureRow = {
  provider: OrderedAnalysisTurnInput["turn"]["provider"];
  sessionId: string;
  turnId: string;
  featureVersion: TurnFeatureVersion;
  analyzedAt: string;
  turnSequence: number;
  turnStatus: StorageTurnStatus;
  promptCharacterCount: number;
  attachmentCount: number;
  toolCallCount: number;
  hasStructuredOutput: boolean;
  hasError: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  costUsd: number | null;
  detail: TurnFeatureDetail;
  evidence: TurnFeatureEvidence;
};

export type TurnFeatureRollupSignals = {
  labels?: readonly string[];
  retryScore?: number;
  frictionScore?: number;
  analyzers?: Partial<
    Record<TurnFeatureAnalyzerName, Partial<TurnFeatureAnalyzerSnapshot>>
  >;
  eligibilityReasons?: readonly string[];
  ruleIds?: readonly string[];
  priorTurnIds?: readonly string[];
};
