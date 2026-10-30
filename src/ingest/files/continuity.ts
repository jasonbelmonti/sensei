// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

const CURSOR_CONTINUITY_CHUNK_BYTES = 64 * 1024;

export async function readCursorContinuityToken(
  filePath: string,
  byteOffset: number,
): Promise<string | null> {
  return (await readCursorCheckpoint(filePath, byteOffset)).token;
}

export async function readCursorCheckpoint(
  filePath: string,
  byteOffset: number,
) {
  if (byteOffset <= 0) {
    return { token: null, line: 0, endsWithNewline: true };
  }

  const fileHandle = await open(filePath, "r");

  try {
    return await hashFilePrefix(fileHandle, byteOffset);
  } finally {
    await fileHandle.close();
  }
}

async function hashFilePrefix(
  fileHandle: Awaited<ReturnType<typeof open>>,
  byteOffset: number,
) {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(
    Math.min(CURSOR_CONTINUITY_CHUNK_BYTES, byteOffset),
  );
  let bytesRemaining = byteOffset;
  let position = 0;
  let newlines = 0;
  let lastByte = 10;

  while (bytesRemaining > 0) {
    const bytesToRead = Math.min(buffer.length, bytesRemaining);
    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      bytesToRead,
      position,
    );

    if (bytesRead !== bytesToRead) {
      throw new Error("Failed to read the full cursor continuity prefix");
    }

    hash.update(buffer.subarray(0, bytesRead));
    for (const byte of buffer.subarray(0, bytesRead))
      if (byte === 10) newlines += 1;
    lastByte = buffer[bytesRead - 1];
    position += bytesRead;
    bytesRemaining -= bytesRead;
  }

  return {
    token: hash.digest("hex"),
    line: newlines + (lastByte === 10 ? 0 : 1),
    endsWithNewline: lastByte === 10,
  };
}
