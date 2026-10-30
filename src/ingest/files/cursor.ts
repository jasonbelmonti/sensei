import type {
  IngestCursor,
  IngestWarningCode,
  ObservedEventSource,
} from "../contracts.js";
import { readCursorContinuityToken } from "./continuity.js";
import type { FileState } from "./discovery.js";

/** Bump when a reader's output or resumable state changes. Byte continuity is insufficient. */
export function readerVersion(source: ObservedEventSource): string {
  // Version 1 could acknowledge EOF without retrying a failed final session.
  const version =
    source.provider === "codex" && source.kind === "transcript" ? 2 : 1;
  return `${source.provider}/${source.kind}/${version}`;
}

export async function cursorResetReason(
  cursor: IngestCursor,
  state: FileState,
  source: ObservedEventSource,
): Promise<{ code: IngestWarningCode; message: string } | null> {
  if (cursor.fingerprint && cursor.fingerprint !== state.fingerprint) {
    return {
      code: "rotated-file",
      message: "File fingerprint changed; replaying source",
    };
  }
  if (cursor.byteOffset > state.size) {
    return {
      code: "truncated-file",
      message: "File shrank below stored cursor; replaying source",
    };
  }
  if (
    !Number.isSafeInteger(cursor.byteOffset) ||
    cursor.byteOffset < 0 ||
    !Number.isSafeInteger(cursor.line) ||
    cursor.line < 0 ||
    !cursor.fingerprint ||
    cursor.metadata?.senseiReaderVersion !== readerVersion(source)
  ) {
    return {
      code: "cursor-reset",
      message:
        "Unverified reader state; replaying source with the owned reader",
    };
  }
  if (
    cursor.byteOffset > 0 &&
    (!cursor.continuityToken ||
      (await readCursorContinuityToken(source.filePath, cursor.byteOffset)) !==
        cursor.continuityToken)
  ) {
    return {
      code: "cursor-reset",
      message: "File prefix changed; replaying source",
    };
  }
  return null;
}

export function hasPendingSnapshot(cursor: IngestCursor): boolean {
  const index = cursor.metadata?.claudeSnapshotReplayIndex;
  return typeof index === "number" && Number.isInteger(index) && index > 0;
}
