import type { OrderedAnalysisTurnInput } from "../storage/index.js";
import { buildTurnFeatureRow } from "./analyzers/rollup.js";
import { buildTurnFeatureSignals } from "./turn-feature-signals.js";
import type { WriteReadyTurnFeatureRow } from "./turn-feature-row.js";

export type BuildTurnFeatureRollupRowOptions = Pick<
  WriteReadyTurnFeatureRow,
  "analyzedAt" | "featureVersion"
> & {
  priorTurns?: readonly OrderedAnalysisTurnInput[];
};

export function buildTurnFeatureRollupRow(
  input: OrderedAnalysisTurnInput,
  options: BuildTurnFeatureRollupRowOptions,
): WriteReadyTurnFeatureRow {
  const signals = buildTurnFeatureSignals(input, {
    priorTurns: options.priorTurns,
  });

  return buildTurnFeatureRow(input, {
    analyzedAt: options.analyzedAt,
    featureVersion: options.featureVersion,
    signals,
  });
}
