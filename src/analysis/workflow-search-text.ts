export function normalizeWorkflowSearchPromptText(promptText: string): string {
  return promptText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type BuildWorkflowSearchTextInput = {
  promptText: string;
  threadName?: string;
  projectPath?: string;
  tags: readonly string[];
  workflowIntentLabels: readonly string[];
};

export function buildWorkflowSearchText(
  input: BuildWorkflowSearchTextInput,
): string {
  return stableUniqueStrings([
    input.promptText,
    sanitizeWorkflowSearchTerm(input.threadName),
    sanitizeWorkflowSearchTerm(input.projectPath),
    ...sanitizeWorkflowSearchTerms(input.tags),
    ...sanitizeWorkflowSearchTerms(input.workflowIntentLabels),
  ]).join(" ");
}

export function sanitizeWorkflowSearchTerms(values: unknown): string[] {
  if (Array.isArray(values) === false) {
    return [];
  }

  return stableUniqueStrings(
    values.flatMap((value) => {
      const term = sanitizeWorkflowSearchTerm(value);

      return term ? [term] : [];
    }),
  );
}

export function sanitizeWorkflowSearchTerm(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function stableUniqueStrings(
  values: readonly (string | undefined)[],
): string[] {
  const uniqueValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    if (value === undefined || seenValues.has(value)) {
      continue;
    }

    seenValues.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}
