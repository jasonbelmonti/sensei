// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function asString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

export function getString(value: unknown): string | undefined {
  return asString(value);
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString) : [];
}

export function toOptionalList<T>(value: T | undefined): T[] {
  return value === undefined ? [] : [value];
}

export function compactUnknownRecord(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const entries = Object.entries(value).filter(
    ([, entry]) => entry !== undefined,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}
