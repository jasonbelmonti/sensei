// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import type { TurnInput } from "../event-contract.js";
import type {
  CodexTranscriptNormalizationContext,
  CodexTranscriptTurnState,
  ParsedArtifact,
} from "./normalize-types.js";
import { createCodexSessionReference } from "./reference.js";

export function emitTurnStarted(
  prompt: string,
  record: unknown,
  context: CodexTranscriptNormalizationContext,
  timestamp?: string,
): ParsedArtifact {
  const turn = ensureActiveTurn(context);

  if (turn.startedEmitted) {
    return {
      sessionId: context.sessionId ?? undefined,
      events: [],
      warnings: [],
    };
  }

  turn.startedEmitted = true;
  turn.inputPrompt = prompt;

  const input: TurnInput = {
    prompt,
  };

  return {
    sessionId: context.sessionId ?? undefined,
    events: [
      {
        type: "turn.started",
        provider: "codex",
        session: createCodexSessionReference(context.sessionId),
        turnId: turn.turnId,
        input,
        timestamp,
        raw: record,
      },
    ],
    warnings: [],
  };
}

export function ensureActiveTurn(
  context: CodexTranscriptNormalizationContext,
): CodexTranscriptTurnState {
  if (context.activeTurn) {
    return context.activeTurn;
  }

  const turn: CodexTranscriptTurnState = {
    startedEmitted: false,
    latestAssistantText: "",
    usage: null,
  };
  context.activeTurn = turn;
  return turn;
}
