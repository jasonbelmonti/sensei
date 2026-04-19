import type { OrderedAnalysisTurnInput } from "../../storage";
import {
  TURN_FEATURE_SCORE_RANGE,
  type TurnFeatureAnalyzerSnapshot,
  type TurnFeatureRollupSignals,
} from "../turn-feature-row";

const FRICTION_SIGNAL_PREFIX = "friction-signals";

const FRICTION_SIGNAL_LABELS = {
  priorTurnRetry: "prior-turn-retry",
  toolFailure: "tool-failure",
  repeatedTool: "repeated-tool",
} as const;

type BuildFrictionSignalsOptions = {
  priorTurns?: readonly OrderedAnalysisTurnInput[];
};

type ToolEventSummary = {
  failureCount: number;
  errorOutcomeCount: number;
  cancelledOutcomeCount: number;
  interruptedToolCallCount: number;
  repeatedToolCallCount: number;
  repeatedToolNameCount: number;
};

type RetrySourceSummary = {
  retrySourceTurns: OrderedAnalysisTurnInput[];
  priorFailedTurnCount: number;
  priorToolFailureCount: number;
};

export function buildFrictionSignals(
  input: OrderedAnalysisTurnInput,
  options: BuildFrictionSignalsOptions = {},
): TurnFeatureRollupSignals {
  const toolEventSummary = summarizeToolEvents(input);
  const retrySummary = collectRetrySourceTurns(options.priorTurns ?? []);
  const analyzerLabels = buildAnalyzerLabels(retrySummary, toolEventSummary);
  const rollupLabels = analyzerLabels.map((label) => toRuleId(label));
  const priorTurnIds = retrySummary.retrySourceTurns.map(
    (turn) => turn.turn.turnId,
  );

  return {
    labels: rollupLabels,
    retryScore: clampScore(retrySummary.retrySourceTurns.length),
    frictionScore: clampScore(
      Math.min(2, toolEventSummary.failureCount) +
        (toolEventSummary.repeatedToolCallCount > 0 ? 1 : 0),
    ),
    analyzers: {
      frictionSignals: buildAnalyzerSnapshot(
        analyzerLabels,
        rollupLabels,
        input,
        retrySummary,
        toolEventSummary,
      ),
    },
    ruleIds: rollupLabels,
    priorTurnIds,
  };
}

function buildAnalyzerSnapshot(
  labels: string[],
  ruleIds: string[],
  input: OrderedAnalysisTurnInput,
  retrySummary: RetrySourceSummary,
  toolEventSummary: ToolEventSummary,
): TurnFeatureAnalyzerSnapshot {
  return {
    applied: labels.length > 0,
    labels,
    ruleIds,
    counts: {
      retrySourceCount: retrySummary.retrySourceTurns.length,
      priorFailedTurnCount: retrySummary.priorFailedTurnCount,
      priorToolFailureCount: retrySummary.priorToolFailureCount,
      toolFailureCount: toolEventSummary.failureCount,
      errorOutcomeCount: toolEventSummary.errorOutcomeCount,
      cancelledOutcomeCount: toolEventSummary.cancelledOutcomeCount,
      interruptedToolCallCount: toolEventSummary.interruptedToolCallCount,
      repeatedToolCallCount: toolEventSummary.repeatedToolCallCount,
      repeatedToolNameCount: toolEventSummary.repeatedToolNameCount,
      toolCallCount: input.toolEvents.length,
    },
    reasons: buildReasons(labels, retrySummary, toolEventSummary),
  };
}

function buildAnalyzerLabels(
  retrySummary: RetrySourceSummary,
  toolEventSummary: ToolEventSummary,
): string[] {
  return [
    ...(retrySummary.retrySourceTurns.length > 0
      ? [FRICTION_SIGNAL_LABELS.priorTurnRetry]
      : []),
    ...(toolEventSummary.failureCount > 0
      ? [FRICTION_SIGNAL_LABELS.toolFailure]
      : []),
    ...(toolEventSummary.repeatedToolCallCount > 0
      ? [FRICTION_SIGNAL_LABELS.repeatedTool]
      : []),
  ];
}

function buildReasons(
  labels: readonly string[],
  retrySummary: RetrySourceSummary,
  toolEventSummary: ToolEventSummary,
): string[] {
  const reasons: string[] = [];

  for (const label of labels) {
    switch (label) {
      case FRICTION_SIGNAL_LABELS.priorTurnRetry:
        reasons.push(
          `detected ${retrySummary.retrySourceTurns.length} consecutive prior turn(s) with failed status or failed tool calls`,
        );
        break;
      case FRICTION_SIGNAL_LABELS.toolFailure:
        reasons.push(
          `detected ${toolEventSummary.failureCount} tool call(s) with error, cancelled, or interrupted outcomes`,
        );
        break;
      case FRICTION_SIGNAL_LABELS.repeatedTool:
        reasons.push(
          `detected repeated tool usage across ${toolEventSummary.repeatedToolNameCount} tool name(s)`,
        );
        break;
      default:
        break;
    }
  }

  return reasons;
}

function collectRetrySourceTurns(
  priorTurns: readonly OrderedAnalysisTurnInput[],
): RetrySourceSummary {
  const retrySourceTurns: OrderedAnalysisTurnInput[] = [];
  let priorFailedTurnCount = 0;
  let priorToolFailureCount = 0;

  for (let index = priorTurns.length - 1; index >= 0; index -= 1) {
    const priorTurn = priorTurns[index];
    const toolEventSummary = summarizeToolEvents(priorTurn);
    const hasFailedStatus = priorTurn.turn.status === "failed";
    const hasToolFailure = toolEventSummary.failureCount > 0;

    if (!hasFailedStatus && !hasToolFailure) {
      break;
    }

    retrySourceTurns.push(priorTurn);
    priorFailedTurnCount += hasFailedStatus ? 1 : 0;
    priorToolFailureCount += toolEventSummary.failureCount;
  }

  retrySourceTurns.reverse();

  return {
    retrySourceTurns,
    priorFailedTurnCount,
    priorToolFailureCount,
  };
}

function summarizeToolEvents(
  input: OrderedAnalysisTurnInput,
): ToolEventSummary {
  let errorOutcomeCount = 0;
  let cancelledOutcomeCount = 0;
  let interruptedToolCallCount = 0;
  const toolNameCounts = new Map<string, number>();

  for (const toolEvent of input.toolEvents) {
    if (toolEvent.outcome === "error") {
      errorOutcomeCount += 1;
    } else if (toolEvent.outcome === "cancelled") {
      cancelledOutcomeCount += 1;
    } else if (
      input.turn.status === "failed" &&
      toolEvent.status !== "completed"
    ) {
      interruptedToolCallCount += 1;
    }

    const toolName = normalizeToolName(toolEvent.toolName);

    if (!toolName) {
      continue;
    }

    toolNameCounts.set(toolName, (toolNameCounts.get(toolName) ?? 0) + 1);
  }

  let repeatedToolCallCount = 0;
  let repeatedToolNameCount = 0;

  for (const count of toolNameCounts.values()) {
    if (count < 2) {
      continue;
    }

    repeatedToolNameCount += 1;
    repeatedToolCallCount += count - 1;
  }

  return {
    failureCount:
      errorOutcomeCount + cancelledOutcomeCount + interruptedToolCallCount,
    errorOutcomeCount,
    cancelledOutcomeCount,
    interruptedToolCallCount,
    repeatedToolCallCount,
    repeatedToolNameCount,
  };
}

function normalizeToolName(toolName: string | undefined): string | undefined {
  if (!toolName) {
    return undefined;
  }

  const normalizedToolName = toolName.trim().toLowerCase();

  return normalizedToolName.length > 0 ? normalizedToolName : undefined;
}

function clampScore(value: number): number {
  return Math.min(
    TURN_FEATURE_SCORE_RANGE.max,
    Math.max(TURN_FEATURE_SCORE_RANGE.min, Math.round(value)),
  );
}

function toRuleId(label: string): string {
  return `${FRICTION_SIGNAL_PREFIX}:${label}`;
}
