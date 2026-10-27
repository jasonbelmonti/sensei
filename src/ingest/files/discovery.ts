import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { DiscoveryRootConfig } from "../contracts.js";

export type FileState = {
  size: number;
  fingerprint: string;
  modifiedAtMs: number;
};

export async function fileState(path: string): Promise<FileState | null> {
  const value = await stat(path).catch(() => null);
  return value?.isFile()
    ? {
        size: value.size,
        fingerprint: `${value.dev}:${value.ino}`,
        modifiedAtMs: value.mtimeMs,
      }
    : null;
}

export async function discoverFiles(
  root: DiscoveryRootConfig,
): Promise<Map<string, FileState>> {
  const files = new Map<string, FileState>();
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && root.recursive !== false) await visit(path);
      else if (entry.isFile()) {
        const state = await fileState(path);
        if (state) files.set(path, state);
      }
    }
  }
  await visit(root.path);
  return files;
}

export function sameFileState(a: FileState, b: FileState): boolean {
  return (
    a.fingerprint === b.fingerprint &&
    a.size === b.size &&
    a.modifiedAtMs === b.modifiedAtMs
  );
}
