export function resolveAnalyzedAt(analyzedAt: string): string {
  if (analyzedAt.trim().length === 0) {
    throw new Error("analyzedAt must be a non-empty timestamp string.");
  }

  return analyzedAt;
}
