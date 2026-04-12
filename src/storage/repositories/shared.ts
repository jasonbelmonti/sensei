export function serializeJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export function parseJson(value: string | null): unknown {
  return value === null ? undefined : JSON.parse(value);
}

export function parseJsonArray(value: string | null): unknown[] | undefined {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : undefined;
}

export function parseJsonRecord(value: string | null) {
  const parsed = parseJson(value);
  return isJsonRecord(parsed) ? parsed : undefined;
}

export function toOptionalLocation(
  line: number | null,
  byteOffset: number | null,
) {
  if (line === null && byteOffset === null) {
    return undefined;
  }

  return {
    line: line ?? undefined,
    byteOffset: byteOffset ?? undefined,
  };
}

export function nowIsoString(): string {
  return new Date().toISOString();
}

function isJsonRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
