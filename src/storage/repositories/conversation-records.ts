import type {
  StoreSessionInput,
  StoredSessionRecord,
  StoreToolEventInput,
  StoredToolEventRecord,
  StoreTurnInput,
  StoredTurnRecord,
  StoreTurnUsageInput,
  StoredTurnUsageRecord,
} from "../schema";
import {
  nowIsoString,
  parseJson,
  parseJsonArray,
  parseJsonRecord,
  serializeJson,
  toOptionalLocation,
} from "./shared";

export type SessionRow = {
  provider: string;
  sessionId: string;
  identityState: string;
  workingDirectory: string | null;
  metadataJson: string | null;
  sourceProvider: string;
  sourceKind: string;
  sourceDiscoveryPhase: string;
  sourceRootPath: string;
  sourceFilePath: string;
  sourceLine: number | null;
  sourceByteOffset: number | null;
  sourceMetadataJson: string | null;
  completeness: string;
  observationReason: string;
  observedAt: string;
  updatedAt: string;
};

export type TurnRow = {
  provider: string;
  sessionId: string;
  turnId: string;
  status: string;
  inputPrompt: string | null;
  inputAttachmentsJson: string | null;
  inputMetadataJson: string | null;
  outputText: string | null;
  outputStructuredOutputJson: string | null;
  stopReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorDetailsJson: string | null;
  rawEventJson: string | null;
  extensionsJson: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  updatedAt: string;
};

export type TurnUsageRow = {
  provider: string;
  sessionId: string;
  turnId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  costUsd: number | null;
  providerUsageJson: string | null;
  updatedAt: string;
};

export type ToolEventRow = {
  provider: string;
  sessionId: string;
  turnId: string;
  toolCallId: string;
  status: string;
  toolName: string | null;
  toolKind: string | null;
  inputJson: string | null;
  outputJson: string | null;
  statusText: string | null;
  outcome: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export function mapSessionRow(row: SessionRow): StoredSessionRecord {
  return {
    provider: row.provider as StoredSessionRecord["provider"],
    sessionId: row.sessionId,
    identityState: row.identityState as StoredSessionRecord["identityState"],
    workingDirectory: row.workingDirectory ?? undefined,
    metadata: parseJsonRecord(row.metadataJson),
    source: {
      provider: row.sourceProvider as StoredSessionRecord["source"]["provider"],
      kind: row.sourceKind as StoredSessionRecord["source"]["kind"],
      discoveryPhase:
        row.sourceDiscoveryPhase as StoredSessionRecord["source"]["discoveryPhase"],
      rootPath: row.sourceRootPath,
      filePath: row.sourceFilePath,
      location: toOptionalLocation(row.sourceLine, row.sourceByteOffset),
      metadata: parseJsonRecord(row.sourceMetadataJson),
    },
    completeness: row.completeness as StoredSessionRecord["completeness"],
    observationReason:
      row.observationReason as StoredSessionRecord["observationReason"],
    observedAt: row.observedAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTurnRow(row: TurnRow): StoredTurnRecord {
  return {
    provider: row.provider as StoredTurnRecord["provider"],
    sessionId: row.sessionId,
    turnId: row.turnId,
    status: row.status as StoredTurnRecord["status"],
    input:
      row.inputPrompt === null &&
      row.inputAttachmentsJson === null &&
      row.inputMetadataJson === null
        ? undefined
        : {
            prompt: row.inputPrompt ?? "",
            attachments: parseJsonArray(row.inputAttachmentsJson),
            metadata: parseJsonRecord(row.inputMetadataJson),
          },
    output:
      row.outputText === null &&
      row.outputStructuredOutputJson === null &&
      row.stopReason === null
        ? undefined
        : {
            text: row.outputText ?? "",
            structuredOutput: parseJson(row.outputStructuredOutputJson),
            stopReason: row.stopReason,
          },
    error:
      row.errorCode === null &&
      row.errorMessage === null &&
      row.errorDetailsJson === null
        ? undefined
        : {
            code: row.errorCode ?? "unknown",
            message: row.errorMessage ?? "",
            details: parseJsonRecord(row.errorDetailsJson),
          },
    raw: parseJson(row.rawEventJson),
    extensions: parseJsonRecord(row.extensionsJson),
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    failedAt: row.failedAt ?? undefined,
    updatedAt: row.updatedAt,
  };
}

export function mapTurnUsageRow(row: TurnUsageRow): StoredTurnUsageRecord {
  return {
    provider: row.provider as StoredTurnUsageRecord["provider"],
    sessionId: row.sessionId,
    turnId: row.turnId,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cachedInputTokens: row.cachedInputTokens ?? undefined,
    costUsd: row.costUsd ?? undefined,
    providerUsage: parseJsonRecord(row.providerUsageJson),
    updatedAt: row.updatedAt,
  };
}

export function mapToolEventRow(row: ToolEventRow): StoredToolEventRecord {
  return {
    provider: row.provider as StoredToolEventRecord["provider"],
    sessionId: row.sessionId,
    turnId: row.turnId,
    toolCallId: row.toolCallId,
    status: row.status as StoredToolEventRecord["status"],
    toolName: row.toolName ?? undefined,
    toolKind:
      row.toolKind === null
        ? undefined
        : (row.toolKind as NonNullable<StoredToolEventRecord["toolKind"]>),
    input: parseJson(row.inputJson),
    output: parseJson(row.outputJson),
    statusText: row.statusText ?? undefined,
    outcome:
      row.outcome === null
        ? undefined
        : (row.outcome as NonNullable<StoredToolEventRecord["outcome"]>),
    errorMessage: row.errorMessage ?? undefined,
    startedAt: row.startedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    updatedAt: row.updatedAt,
  };
}

export function mergeSessionRecord(
  existing: StoredSessionRecord | null,
  input: StoreSessionInput,
): StoredSessionRecord {
  const timestamp = nowIsoString();

  if (existing === null) {
    return {
      provider: input.provider,
      sessionId: input.sessionId,
      identityState: input.identityState,
      workingDirectory: input.workingDirectory,
      metadata: input.metadata,
      source: {
        provider: input.source.provider,
        kind: input.source.kind,
        discoveryPhase: input.source.discoveryPhase,
        rootPath: input.source.rootPath,
        filePath: input.source.filePath,
        location: input.source.location,
        metadata: input.source.metadata,
      },
      completeness: input.completeness,
      observationReason: input.observationReason,
      observedAt: input.observedAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  const shouldReplaceObservation = shouldReplaceSessionObservation(existing, input);
  const canReuseSourceDetails =
    shouldReplaceObservation &&
    matchesSessionSourceIdentity(existing.source, input.source);

  return {
    provider: input.provider,
    sessionId: input.sessionId,
    identityState: pickStrongerSessionIdentityState(
      existing?.identityState,
      input.identityState,
    ),
    workingDirectory: shouldReplaceObservation
      ? (input.workingDirectory ?? existing?.workingDirectory)
      : existing.workingDirectory,
    metadata: shouldReplaceObservation
      ? (input.metadata ?? existing?.metadata)
      : existing.metadata,
    source: shouldReplaceObservation
      ? {
          provider: input.source.provider,
          kind: input.source.kind,
          discoveryPhase: input.source.discoveryPhase,
          rootPath: input.source.rootPath,
          filePath: input.source.filePath,
          location: canReuseSourceDetails
            ? (input.source.location ?? existing.source.location)
            : input.source.location,
          metadata: canReuseSourceDetails
            ? (input.source.metadata ?? existing.source.metadata)
            : input.source.metadata,
        }
      : existing.source,
    completeness: shouldReplaceObservation
      ? pickStrongerSessionCompleteness(existing?.completeness, input.completeness)
      : existing.completeness,
    observationReason: shouldReplaceObservation
      ? input.observationReason
      : existing.observationReason,
    observedAt: shouldReplaceObservation
      ? (input.observedAt ?? existing?.observedAt ?? timestamp)
      : existing.observedAt,
    updatedAt: timestamp,
  };
}

export function mergeTurnRecord(
  existing: StoredTurnRecord | null,
  input: StoreTurnInput,
): StoredTurnRecord {
  const timestamp = nowIsoString();
  const status = pickStrongerTurnStatus(existing?.status, input.status);
  const shouldReplacePayload = shouldReplaceTurnPayload(existing, input);
  const isCompleted = status === "completed";

  return {
    provider: input.provider,
    sessionId: input.sessionId,
    turnId: input.turnId,
    status,
    input: shouldReplacePayload ? (input.input ?? existing?.input) : existing?.input,
    output: shouldReplacePayload
      ? (input.output ?? existing?.output)
      : existing?.output,
    error: isCompleted
      ? undefined
      : shouldReplacePayload
        ? (input.error ?? existing?.error)
        : existing?.error,
    raw: shouldReplacePayload ? (input.raw ?? existing?.raw) : existing?.raw,
    extensions: shouldReplacePayload
      ? (input.extensions ?? existing?.extensions)
      : existing?.extensions,
    startedAt: shouldReplacePayload
      ? (input.startedAt ?? existing?.startedAt)
      : existing?.startedAt,
    completedAt: shouldReplacePayload
      ? (input.completedAt ?? existing?.completedAt)
      : existing?.completedAt,
    failedAt: isCompleted
      ? undefined
      : shouldReplacePayload
        ? (input.failedAt ?? existing?.failedAt)
        : existing?.failedAt,
    updatedAt: timestamp,
  };
}

export function mergeTurnUsageRecord(
  existing: StoredTurnUsageRecord | null,
  input: StoreTurnUsageInput,
): StoredTurnUsageRecord {
  const shouldReplaceProviderUsage =
    existing === null ||
    (input.inputTokens >= existing.inputTokens &&
      input.outputTokens >= existing.outputTokens);

  return {
    provider: input.provider,
    sessionId: input.sessionId,
    turnId: input.turnId,
    inputTokens: pickGreaterNumber(existing?.inputTokens, input.inputTokens) ?? 0,
    outputTokens: pickGreaterNumber(existing?.outputTokens, input.outputTokens) ?? 0,
    cachedInputTokens: pickGreaterNumber(
      existing?.cachedInputTokens,
      input.cachedInputTokens,
    ),
    costUsd: pickGreaterNumber(existing?.costUsd, input.costUsd),
    providerUsage: shouldReplaceProviderUsage
      ? (input.providerUsage ?? existing?.providerUsage)
      : existing?.providerUsage,
    updatedAt: nowIsoString(),
  };
}

export function mergeToolEventRecord(
  existing: StoredToolEventRecord | null,
  input: StoreToolEventInput,
): StoredToolEventRecord {
  const timestamp = nowIsoString();
  const status = pickStrongerToolEventStatus(existing?.status, input.status);
  const shouldReplacePayload = shouldReplaceToolEventPayload(existing, input);
  const outcome = shouldReplacePayload
    ? (input.outcome ?? existing?.outcome)
    : existing?.outcome;
  const clearsErrorMessage = outcome === "success";

  return {
    provider: input.provider,
    sessionId: input.sessionId,
    turnId: input.turnId,
    toolCallId: input.toolCallId,
    status,
    toolName: shouldReplacePayload
      ? (input.toolName ?? existing?.toolName)
      : existing?.toolName,
    toolKind: shouldReplacePayload
      ? (input.toolKind ?? existing?.toolKind)
      : existing?.toolKind,
    input: shouldReplacePayload ? (input.input ?? existing?.input) : existing?.input,
    output: shouldReplacePayload
      ? (input.output ?? existing?.output)
      : existing?.output,
    statusText: shouldReplacePayload
      ? (input.statusText ?? existing?.statusText)
      : existing?.statusText,
    outcome,
    errorMessage: clearsErrorMessage
      ? undefined
      : shouldReplacePayload
        ? (input.errorMessage ?? existing?.errorMessage)
        : existing?.errorMessage,
    startedAt: shouldReplacePayload
      ? (input.startedAt ?? existing?.startedAt)
      : existing?.startedAt,
    completedAt: shouldReplacePayload
      ? (input.completedAt ?? existing?.completedAt)
      : existing?.completedAt,
    updatedAt: timestamp,
  };
}

export function sessionStatementParams(record: StoredSessionRecord) {
  return [
    record.provider,
    record.sessionId,
    record.identityState,
    record.workingDirectory ?? null,
    serializeJson(record.metadata),
    record.source.provider,
    record.source.kind,
    record.source.discoveryPhase,
    record.source.rootPath,
    record.source.filePath,
    record.source.location?.line ?? null,
    record.source.location?.byteOffset ?? null,
    serializeJson(record.source.metadata),
    record.completeness,
    record.observationReason,
    record.observedAt,
    record.updatedAt,
  ] as const;
}

export function turnStatementParams(record: StoredTurnRecord) {
  return [
    record.provider,
    record.sessionId,
    record.turnId,
    record.status,
    record.input?.prompt ?? null,
    serializeJson(record.input?.attachments),
    serializeJson(record.input?.metadata),
    record.output?.text ?? null,
    serializeJson(record.output?.structuredOutput),
    record.output?.stopReason ?? null,
    record.error?.code ?? null,
    record.error?.message ?? null,
    serializeJson(record.error?.details),
    serializeJson(record.raw),
    serializeJson(record.extensions),
    record.startedAt ?? null,
    record.completedAt ?? null,
    record.failedAt ?? null,
    record.updatedAt,
  ] as const;
}

export function turnUsageStatementParams(record: StoredTurnUsageRecord) {
  return [
    record.provider,
    record.sessionId,
    record.turnId,
    record.inputTokens,
    record.outputTokens,
    record.cachedInputTokens ?? null,
    record.costUsd ?? null,
    serializeJson(record.providerUsage),
    record.updatedAt,
  ] as const;
}

export function toolEventStatementParams(record: StoredToolEventRecord) {
  return [
    record.provider,
    record.sessionId,
    record.turnId,
    record.toolCallId,
    record.status,
    record.toolName ?? null,
    record.toolKind ?? null,
    serializeJson(record.input),
    serializeJson(record.output),
    record.statusText ?? null,
    record.outcome ?? null,
    record.errorMessage ?? null,
    record.startedAt ?? null,
    record.completedAt ?? null,
    record.updatedAt,
  ] as const;
}

function pickStrongerSessionIdentityState(
  existing: StoredSessionRecord["identityState"] | undefined,
  incoming: StoreSessionInput["identityState"],
): StoredSessionRecord["identityState"] {
  if (existing === undefined) {
    return incoming;
  }

  return sessionIdentityStateRank(incoming) >= sessionIdentityStateRank(existing)
    ? incoming
    : existing;
}

function pickStrongerSessionCompleteness(
  existing: StoredSessionRecord["completeness"] | undefined,
  incoming: StoreSessionInput["completeness"],
): StoredSessionRecord["completeness"] {
  if (existing === undefined) {
    return incoming;
  }

  return sessionCompletenessRank(incoming) >= sessionCompletenessRank(existing)
    ? incoming
    : existing;
}

function pickStrongerTurnStatus(
  existing: StoredTurnRecord["status"] | undefined,
  incoming: StoreTurnInput["status"],
): StoredTurnRecord["status"] {
  if (existing === undefined) {
    return incoming;
  }

  return turnStatusRank(incoming) >= turnStatusRank(existing) ? incoming : existing;
}

function pickStrongerToolEventStatus(
  existing: StoredToolEventRecord["status"] | undefined,
  incoming: StoreToolEventInput["status"],
): StoredToolEventRecord["status"] {
  if (existing === undefined) {
    return incoming;
  }

  return toolEventStatusRank(incoming) >= toolEventStatusRank(existing)
    ? incoming
    : existing;
}

function shouldReplaceTurnPayload(
  existing: StoredTurnRecord | null,
  incoming: StoreTurnInput,
): boolean {
  return existing === null || turnStatusRank(incoming.status) >= turnStatusRank(existing.status);
}

function shouldReplaceToolEventPayload(
  existing: StoredToolEventRecord | null,
  incoming: StoreToolEventInput,
): boolean {
  return (
    existing === null ||
    toolEventStatusRank(incoming.status) >= toolEventStatusRank(existing.status)
  );
}

function sessionIdentityStateRank(
  identityState: StoreSessionInput["identityState"] | StoredSessionRecord["identityState"],
): number {
  switch (identityState) {
    case "provisional":
      return 0;
    case "canonical":
      return 1;
  }
}

function sessionCompletenessRank(
  completeness: StoreSessionInput["completeness"] | StoredSessionRecord["completeness"],
): number {
  switch (completeness) {
    case "best-effort":
      return 0;
    case "partial":
      return 1;
    case "complete":
      return 2;
  }
}

function turnStatusRank(
  status: StoreTurnInput["status"] | StoredTurnRecord["status"],
): number {
  switch (status) {
    case "started":
      return 0;
    case "failed":
      return 1;
    case "completed":
      return 2;
  }
}

function toolEventStatusRank(
  status: StoreToolEventInput["status"] | StoredToolEventRecord["status"],
): number {
  switch (status) {
    case "started":
      return 0;
    case "updated":
      return 1;
    case "completed":
      return 2;
  }
}

function shouldReplaceSessionObservation(
  existing: StoredSessionRecord | null,
  incoming: StoreSessionInput,
): boolean {
  if (existing === null) {
    return true;
  }

  const identityDifference =
    sessionIdentityStateRank(incoming.identityState) -
    sessionIdentityStateRank(existing.identityState);

  if (identityDifference !== 0) {
    return identityDifference > 0;
  }

  return (
    sessionCompletenessRank(incoming.completeness) >
    sessionCompletenessRank(existing.completeness)
  );
}

function matchesSessionSourceIdentity(
  existing: StoredSessionRecord["source"],
  incoming: StoreSessionInput["source"],
): boolean {
  return (
    existing.provider === incoming.provider &&
    existing.kind === incoming.kind &&
    existing.discoveryPhase === incoming.discoveryPhase &&
    existing.rootPath === incoming.rootPath &&
    existing.filePath === incoming.filePath
  );
}

function pickGreaterNumber(
  existing: number | undefined,
  incoming: number | undefined,
): number | undefined {
  if (existing === undefined) {
    return incoming;
  }

  if (incoming === undefined) {
    return existing;
  }

  return incoming >= existing ? incoming : existing;
}
