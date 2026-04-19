import type { OrderedAnalysisTurnInput } from "../storage";
import { buildTurnFeatureRow } from "./analyzers/rollup";
import { buildTurnFeatureSignals } from "./turn-feature-signals";
import type { WriteReadyTurnFeatureRow } from "./turn-feature-row";

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
