import type { OrderedAnalysisTurnInput } from "../storage";
import { buildFrictionSignals } from "./analyzers/friction-signals";
import { buildPromptSemanticSignals } from "./analyzers/prompt-semantic-signals";
import type { TurnFeatureRollupSignals } from "./turn-feature-row";

type BuildTurnFeatureSignalsOptions = {
  priorTurns?: readonly OrderedAnalysisTurnInput[];
};

export function buildTurnFeatureSignals(
  orderedTurn: OrderedAnalysisTurnInput,
  options: BuildTurnFeatureSignalsOptions = {},
): TurnFeatureRollupSignals | undefined {
  return mergeTurnFeatureRollupSignals(
    buildPromptSemanticSignals(orderedTurn.turn.input?.prompt ?? ""),
    buildFrictionSignals(orderedTurn, {
      priorTurns: options.priorTurns,
    }),
  );
}

function mergeTurnFeatureRollupSignals(
  ...signalGroups: Array<TurnFeatureRollupSignals | undefined>
): TurnFeatureRollupSignals | undefined {
  const definedSignalGroups = signalGroups.filter(
    (signals): signals is TurnFeatureRollupSignals => signals !== undefined,
  );

  if (definedSignalGroups.length === 0) {
    return undefined;
  }

  const mergedAnalyzers: NonNullable<TurnFeatureRollupSignals["analyzers"]> = {};

  for (const signals of definedSignalGroups) {
    if (!signals.analyzers) {
      continue;
    }

    Object.assign(mergedAnalyzers, signals.analyzers);
  }

  return {
    labels: optionalStableUniqueStrings(
      definedSignalGroups.flatMap((signals) => signals.labels ?? []),
    ),
    retryScore: sumFiniteNumbers(
      definedSignalGroups.map((signals) => signals.retryScore),
    ),
    frictionScore: sumFiniteNumbers(
      definedSignalGroups.map((signals) => signals.frictionScore),
    ),
    analyzers:
      Object.keys(mergedAnalyzers).length > 0 ? mergedAnalyzers : undefined,
    eligibilityReasons: optionalStableUniqueStrings(
      definedSignalGroups.flatMap(
        (signals) => signals.eligibilityReasons ?? [],
      ),
    ),
    ruleIds: optionalStableUniqueStrings(
      definedSignalGroups.flatMap((signals) => signals.ruleIds ?? []),
    ),
    priorTurnIds: optionalStableUniqueStrings(
      definedSignalGroups.flatMap((signals) => signals.priorTurnIds ?? []),
    ),
  };
}

function sumFiniteNumbers(values: readonly (number | undefined)[]): number {
  return values.reduce<number>((total, value) => {
    if (value === undefined || !Number.isFinite(value)) {
      return total;
    }

    return total + value;
  }, 0);
}

function optionalStableUniqueStrings(
  values: readonly string[],
): string[] | undefined {
  const uniqueValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues.length > 0 ? uniqueValues : undefined;
}
