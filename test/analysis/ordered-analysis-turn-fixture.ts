import type { OrderedAnalysisTurnInput } from "../../src/storage";

type OrderedTurnInputUsageOverrides = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  costUsd?: number;
};

type OrderedTurnInputToolEventOverrides = {
  toolCallId: string;
  status: OrderedAnalysisTurnInput["toolEvents"][number]["status"];
  toolName?: string;
  outcome?: OrderedAnalysisTurnInput["toolEvents"][number]["outcome"];
  errorMessage?: string;
};

export type OrderedTurnInputOverrides = {
  provider?: OrderedAnalysisTurnInput["turn"]["provider"];
  sessionId?: string;
  turnSequence: number;
  turnId: string;
  prompt?: string;
  attachments?: NonNullable<
    OrderedAnalysisTurnInput["turn"]["input"]
  >["attachments"];
  status?: OrderedAnalysisTurnInput["turn"]["status"];
  output?: OrderedAnalysisTurnInput["turn"]["output"];
  error?: OrderedAnalysisTurnInput["turn"]["error"];
  usage?: OrderedTurnInputUsageOverrides;
  toolEvents?: OrderedTurnInputToolEventOverrides[];
};

export function createOrderedTurnInput(
  overrides: OrderedTurnInputOverrides,
): OrderedAnalysisTurnInput {
  const {
    provider = "codex",
    sessionId = "session-1",
    turnSequence,
    turnId,
    status = "completed",
    output,
    error,
    usage,
  } = overrides;
  const toolEvents = overrides.toolEvents ?? [];
  const timestamp = createFixtureTimestamp(turnSequence);

  return {
    turnSequence,
    turn: {
      provider,
      sessionId,
      turnId,
      status,
      input: createTurnInput(overrides),
      output,
      error,
      updatedAt: timestamp,
      completedAt: status === "completed" ? timestamp : undefined,
      failedAt: status === "failed" ? timestamp : undefined,
    },
    usage: usage
      ? {
          provider,
          sessionId,
          turnId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          costUsd: usage.costUsd,
          updatedAt: timestamp,
        }
      : undefined,
    toolEvents: toolEvents.map((toolEvent, index) =>
      createToolEvent(
        provider,
        sessionId,
        turnSequence,
        turnId,
        toolEvent,
        index,
      ),
    ),
  };
}

function createTurnInput(
  overrides: OrderedTurnInputOverrides,
): OrderedAnalysisTurnInput["turn"]["input"] {
  const { prompt, attachments } = overrides;
  const hasTurnInput = prompt !== undefined || attachments !== undefined;

  if (!hasTurnInput) {
    return undefined;
  }

  return {
    prompt: prompt ?? "",
    attachments: attachments ?? [],
  };
}

function createToolEvent(
  provider: OrderedAnalysisTurnInput["turn"]["provider"],
  sessionId: string,
  turnSequence: number,
  turnId: string,
  toolEvent: OrderedTurnInputToolEventOverrides,
  index: number,
): OrderedAnalysisTurnInput["toolEvents"][number] {
  const timestamp = createFixtureTimestamp(turnSequence, index);

  return {
    provider,
    sessionId,
    turnId,
    toolCallId: toolEvent.toolCallId,
    status: toolEvent.status,
    toolName: toolEvent.toolName,
    outcome: toolEvent.outcome,
    errorMessage: toolEvent.errorMessage,
    updatedAt: timestamp,
    completedAt: toolEvent.status === "completed" ? timestamp : undefined,
  };
}

function createFixtureTimestamp(
  turnSequence: number,
  second = 0,
): string {
  return `2026-04-18T19:${String(turnSequence).padStart(2, "0")}:${String(
    second,
  ).padStart(2, "0")}.000Z`;
}
