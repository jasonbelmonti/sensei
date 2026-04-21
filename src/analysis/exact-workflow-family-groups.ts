import type {
	ExactWorkflowFamilyGroup,
	WorkflowFamilySourceRow,
} from "./workflow-family-output";

export function buildExactWorkflowFamilyGroups(
	rows: readonly WorkflowFamilySourceRow[],
): ExactWorkflowFamilyGroup[] {
	const groups = new Map<string, WorkflowFamilySourceRow[]>();

	for (const row of rows) {
		const groupKey = createExactWorkflowFamilyGroupKey(row);
		const groupedRows = groups.get(groupKey);

		if (groupedRows === undefined) {
			groups.set(groupKey, [row]);
			continue;
		}

		groupedRows.push(row);
	}

	return [...groups.entries()]
		.map(([key, groupedRows]) =>
			buildExactWorkflowFamilyGroup(key, groupedRows),
		)
		.sort(compareExactWorkflowFamilyGroups);
}

function buildExactWorkflowFamilyGroup(
	key: string,
	rows: readonly WorkflowFamilySourceRow[],
): ExactWorkflowFamilyGroup {
	const sortedRows = [...rows].sort(compareWorkflowFamilyRows);
	const [anchor, ...remainingRows] = sortedRows;

	if (anchor === undefined) {
		throw new Error(
			`workflow family group ${key} must include at least one row`,
		);
	}

	return {
		key,
		featureVersion: anchor.featureVersion,
		exactFingerprint: firstDefinedValue(
			anchor.exactFingerprint,
			remainingRows,
			"exactFingerprint",
		),
		nearFingerprint: firstDefinedValue(
			anchor.nearFingerprint,
			remainingRows,
			"nearFingerprint",
		),
		projectPath: firstDefinedValue(
			anchor.projectPath,
			remainingRows,
			"projectPath",
		),
		rows: sortedRows,
		anchor,
		tags: collectUniqueStrings(sortedRows, (row) => row.tags),
		workflowIntentLabels: collectUniqueStrings(
			sortedRows,
			(row) => row.workflowIntentLabels,
		),
		threadNames: collectDefinedStrings(sortedRows, (row) => row.threadName),
		projectPaths: collectDefinedStrings(sortedRows, (row) => row.projectPath),
	};
}

function createExactWorkflowFamilyGroupKey(
	row: WorkflowFamilySourceRow,
): string {
	if (row.exactFingerprint === undefined) {
		return `turn\u0000${createTurnKey(row)}`;
	}

	if (row.projectPath !== undefined) {
		return `exact\u0000${row.exactFingerprint}\u0000project\u0000${row.projectPath}`;
	}

	return `exact\u0000${row.exactFingerprint}`;
}

function compareExactWorkflowFamilyGroups(
	left: ExactWorkflowFamilyGroup,
	right: ExactWorkflowFamilyGroup,
): number {
	return (
		compareStrings(left.key, right.key) ||
		compareWorkflowFamilyRows(left.anchor, right.anchor)
	);
}

function compareWorkflowFamilyRows(
	left: WorkflowFamilySourceRow,
	right: WorkflowFamilySourceRow,
): number {
	return (
		compareStrings(left.updatedAt ?? "", right.updatedAt ?? "") ||
		compareStrings(createTurnKey(left), createTurnKey(right))
	);
}

function createTurnKey(row: WorkflowFamilySourceRow): string {
	return `${row.provider}\u0000${row.sessionId}\u0000${row.turnId}`;
}

function compareStrings(left: string, right: string): number {
	return left.localeCompare(right);
}

function uniqueSortedStrings(values: readonly string[]): string[] {
	return [...new Set(values)].sort(compareStrings);
}

function collectUniqueStrings(
	rows: readonly WorkflowFamilySourceRow[],
	getValues: (row: WorkflowFamilySourceRow) => readonly string[],
): string[] {
	return [...new Set(rows.flatMap(getValues))].sort(compareStrings);
}

function collectDefinedStrings(
	rows: readonly WorkflowFamilySourceRow[],
	getValue: (row: WorkflowFamilySourceRow) => string | undefined,
): string[] {
	const values: string[] = [];

	for (const row of rows) {
		const value = getValue(row);

		if (value !== undefined) {
			values.push(value);
		}
	}

	return uniqueSortedStrings(values);
}

function firstDefinedValue<
	K extends keyof Pick<
		WorkflowFamilySourceRow,
		"exactFingerprint" | "nearFingerprint" | "projectPath"
	>,
>(
	firstValue: WorkflowFamilySourceRow[K],
	remainingRows: readonly WorkflowFamilySourceRow[],
	key: K,
): WorkflowFamilySourceRow[K] {
	if (firstValue !== undefined) {
		return firstValue;
	}

	for (const row of remainingRows) {
		const value = row[key];

		if (value !== undefined) {
			return value;
		}
	}

	return undefined;
}
