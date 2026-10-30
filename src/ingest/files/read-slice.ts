import { open } from "node:fs/promises";

/** Read the fixed extent selected by discovery; appends belong to the next pass. */
export async function readFileSlice(
  filePath: string,
  byteOffset = 0,
  byteLength?: number,
) {
  const file = await open(filePath, "r");
  try {
    const size = Math.min(
      (await file.stat()).size,
      byteLength ?? Number.MAX_SAFE_INTEGER,
    );
    const bytes = Buffer.alloc(Math.max(0, size - byteOffset));
    let read = 0;
    while (read < bytes.length) {
      const result = await file.read(
        bytes,
        read,
        bytes.length - read,
        byteOffset + read,
      );
      if (result.bytesRead === 0)
        throw new Error("Source truncated while reading");
      read += result.bytesRead;
    }
    return { size, bytes };
  } finally {
    await file.close();
  }
}

/** A malformed unterminated tail may still be in flight. Never consume its bytes. */
export async function readJsonlSlice(
  filePath: string,
  byteOffset = 0,
  onIncompleteLine?: () => Promise<void>,
  byteLength?: number,
) {
  const slice = await readFileSlice(filePath, byteOffset, byteLength);
  const boundary = slice.bytes.lastIndexOf(10) + 1;
  const tail = slice.bytes.subarray(boundary).toString("utf8").trim();
  if (tail.length === 0) return slice;
  try {
    JSON.parse(tail);
    return slice;
  } catch {
    await onIncompleteLine?.();
    return { size: slice.size, bytes: slice.bytes.subarray(0, boundary) };
  }
}
