import type {
  DiscoveryPhase,
  DiscoveryRootConfig,
  IngestCursor,
  IngestFileMatch,
  IngestProviderRegistry,
  ObservedIngestRecord,
  SessionIngestServiceOptions,
} from "../contracts.js";
import {
  readCursorCheckpoint,
  readCursorContinuityToken,
} from "./continuity.js";
import {
  cursorResetReason,
  hasPendingSnapshot,
  readerVersion,
} from "./cursor.js";
import { fileState } from "./discovery.js";
import { consumeParsedRecords } from "./record-consumption.js";
import { buildObservedEventSource } from "./source.js";

export async function processFile(options: {
  root: DiscoveryRootConfig;
  filePath: string;
  reader: IngestProviderRegistry;
  match: IngestFileMatch;
  phase: DiscoveryPhase;
  changed: boolean;
  service: SessionIngestServiceOptions;
}): Promise<void> {
  const { root, filePath, reader, match, phase, service } = options;
  const source = buildObservedEventSource({
    provider: root.provider,
    kind: match.kind,
    discoveryPhase: phase,
    rootPath: root.path,
    filePath,
    rootMetadata: root.metadata,
    matchMetadata: match.metadata,
  });
  const key = { provider: root.provider, rootPath: root.path, filePath };
  await service.onDiscoveryEvent?.({
    ...key,
    discoveryPhase: phase,
    type: options.changed ? "file.changed" : "file.discovered",
  });
  const before = await fileState(filePath);
  if (!before) {
    await service.onWarning?.({
      code: "file-open-failed",
      message: "Source is no longer readable",
      source,
      ...key,
    });
    return;
  }
  let cursor = (await service.cursorStore?.get(key)) ?? null;
  if (cursor) {
    const reset = await cursorResetReason(cursor, before, source);
    if (reset) {
      await service.onWarning?.({ ...reset, source, ...key });
      // Storage upserts are monotonic. Remove the old generation before recording a lower offset.
      await service.cursorStore?.delete(key);
      cursor = null;
    } else if (cursor.byteOffset === before.size && !hasPendingSnapshot(cursor))
      return;
  }
  const prefix = await readCursorContinuityToken(filePath, before.size);
  const records = await reader.parseFile({
    root,
    filePath,
    discoveryPhase: phase,
    match,
    cursor,
    byteLength: before.size,
    onIncompleteLine: async () => {
      await service.onWarning?.({
        code: "parse-failed",
        message: "Incomplete final JSONL record remains pending",
        source,
        ...key,
      });
    },
  });
  const consumed = await consumeParsedRecords({
    initialCursor: cursor,
    records,
    onRecord: (record) => dispatchRecord(service, record),
  });
  if (consumed.parseError) {
    await service.onWarning?.({
      code: "parse-failed",
      message: "Reader failed while processing source",
      source,
      ...key,
      cause: consumed.parseError,
    });
  }
  const after = await fileState(filePath);
  const unchanged =
    after &&
    before.fingerprint === after.fingerprint &&
    after.size >= before.size &&
    prefix === (await readCursorContinuityToken(filePath, before.size));
  if (!unchanged) {
    await service.onWarning?.({
      code: "cursor-reset",
      message: "Source changed while processing; progress was not acknowledged",
      source,
      ...key,
    });
    await service.cursorStore?.delete(key);
  } else if (consumed.latestCursor) {
    const latest = consumed.latestCursor;
    const checkpoint = await readCursorCheckpoint(filePath, latest.byteOffset);
    const committed: IngestCursor = {
      ...latest,
      fingerprint: after.fingerprint,
      line: match.kind === "snapshot" ? latest.line : checkpoint.line,
      continuityToken: checkpoint.token ?? undefined,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...latest.metadata,
        senseiReaderVersion: readerVersion(source),
        modifiedAtMs: after.modifiedAtMs,
        senseiEndedAtNewline:
          match.kind === "snapshot" ? undefined : checkpoint.endsWithNewline,
      },
    };
    await service.cursorStore?.set(committed);
    await service.onCursor?.(committed);
  }
  if (consumed.consumerError) throw consumed.consumerError;
  if (consumed.parseError) throw consumed.parseError;
  if (!unchanged)
    throw new Error("Source changed while processing; retry required");
}

async function dispatchRecord(
  service: SessionIngestServiceOptions,
  record: ObservedIngestRecord,
) {
  for (const warning of record.warnings ?? [])
    await service.onWarning?.(warning);
  if (record.kind === "event") await service.onObservedEvent?.(record);
  else await service.onObservedSession?.(record);
  await service.onRecord?.(record);
}
