// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import {
  asString,
  compactUnknownRecord,
  isRecord,
  isString,
} from "./normalize-values.js";

type ClaudeArtifactNormalizationSessionState = {
  latestAssistantText?: string;
  workingDirectory?: string;
};

export type ClaudeArtifactNormalizationContext = {
  sessions: Map<string, ClaudeArtifactNormalizationSessionState>;
};

const CLAUDE_ARTIFACT_NORMALIZATION_METADATA_KEY =
  "claudePendingAssistantTexts";
const DEFAULT_CONTEXT_SESSION_KEY = "__default__";

export function createClaudeArtifactNormalizationContext(
  metadata?: Record<string, unknown>,
): ClaudeArtifactNormalizationContext {
  const persistedSessions =
    metadata?.[CLAUDE_ARTIFACT_NORMALIZATION_METADATA_KEY];
  const sessions = new Map<string, ClaudeArtifactNormalizationSessionState>();

  if (isRecord(persistedSessions)) {
    for (const [sessionKey, persistedSessionState] of Object.entries(
      persistedSessions,
    )) {
      const sessionState = parsePersistedSessionState(persistedSessionState);
      if (!sessionState) {
        continue;
      }

      sessions.set(sessionKey, sessionState);
    }
  }

  return {
    sessions,
  };
}

export function createClaudeArtifactNormalizationMetadata(
  context: ClaudeArtifactNormalizationContext,
): Record<string, unknown> | undefined {
  if (context.sessions.size === 0) {
    return;
  }

  const persistedSessions = Object.fromEntries(
    [...context.sessions.entries()].flatMap(([sessionKey, sessionState]) => {
      const persistedSessionState = serializeSessionState(sessionState);
      return persistedSessionState === undefined
        ? []
        : [[sessionKey, persistedSessionState]];
    }),
  );

  if (Object.keys(persistedSessions).length === 0) {
    return;
  }

  return {
    [CLAUDE_ARTIFACT_NORMALIZATION_METADATA_KEY]: persistedSessions,
  };
}

export function getClaudeArtifactWorkingDirectory(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionId: string | undefined,
): string | undefined {
  if (!context) {
    return;
  }

  return context.sessions.get(getContextSessionKey(sessionId))
    ?.workingDirectory;
}

export function getContextSessionKey(sessionId: string | undefined): string {
  return sessionId ?? DEFAULT_CONTEXT_SESSION_KEY;
}

export function setLatestAssistantText(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionKey: string,
  text: string,
): void {
  updateSessionState(context, sessionKey, {
    latestAssistantText: text,
  });
}

export function consumeLatestAssistantText(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionKey: string,
): string | undefined {
  const latestAssistantText = getSessionState(
    context,
    sessionKey,
  )?.latestAssistantText;
  clearLatestAssistantText(context, sessionKey);
  return latestAssistantText;
}

export function clearLatestAssistantText(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionKey: string,
): void {
  updateSessionState(context, sessionKey, {
    latestAssistantText: undefined,
  });
}

export function setWorkingDirectory(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionKey: string,
  workingDirectory: string,
): void {
  updateSessionState(context, sessionKey, {
    workingDirectory,
  });
}

export function updateSessionState(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionKey: string,
  patch: ClaudeArtifactNormalizationSessionState,
): void {
  if (!context) {
    return;
  }

  const state = {
    ...getSessionState(context, sessionKey),
    ...patch,
  };

  if (!state.latestAssistantText && !state.workingDirectory) {
    context.sessions.delete(sessionKey);
    return;
  }

  context.sessions.set(sessionKey, state);
}

export function parsePersistedSessionState(
  value: unknown,
): ClaudeArtifactNormalizationSessionState | undefined {
  if (isString(value)) {
    return {
      latestAssistantText: value,
    };
  }

  if (!isRecord(value)) {
    return;
  }

  const state = compactUnknownRecord({
    latestAssistantText: asString(value.latestAssistantText),
    workingDirectory: asString(value.workingDirectory),
  });

  return state;
}

export function serializeSessionState(
  state: ClaudeArtifactNormalizationSessionState,
): string | Record<string, unknown> | undefined {
  if (state.latestAssistantText && !state.workingDirectory) {
    return state.latestAssistantText;
  }

  return compactUnknownRecord({
    latestAssistantText: state.latestAssistantText,
    workingDirectory: state.workingDirectory,
  });
}

export function getSessionState(
  context: ClaudeArtifactNormalizationContext | undefined,
  sessionKey: string,
): ClaudeArtifactNormalizationSessionState | undefined {
  return context?.sessions.get(sessionKey);
}
