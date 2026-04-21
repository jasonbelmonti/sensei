export function buildWorkflowSearchMatchQuery(
	queryText: string,
): string | undefined {
	const tokens = tokenizeWorkflowSearchQuery(queryText);

	if (tokens.length === 0) {
		return undefined;
	}

	return stableUniqueStrings(tokens)
		.map((token) => `"${token}"`)
		.join(" AND ");
}

export function resolveWorkflowSearchLimit(
	limit: number | undefined,
): number {
	if (limit === undefined) {
		return 20;
	}

	if (Number.isInteger(limit) === false || limit < 1) {
		throw new Error(
			`workflow search limit must be a positive integer, received ${limit}.`,
		);
	}

	return limit;
}

function tokenizeWorkflowSearchQuery(queryText: string): string[] {
	return queryText
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.split(/\s+/)
		.filter((token) => token.length > 0);
}

function stableUniqueStrings(values: readonly string[]): string[] {
	const uniqueValues: string[] = [];
	const seenValues = new Set<string>();

	for (const value of values) {
		if (seenValues.has(value)) {
			continue;
		}

		seenValues.add(value);
		uniqueValues.push(value);
	}

	return uniqueValues;
}
