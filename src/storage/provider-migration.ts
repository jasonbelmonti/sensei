import type { Database } from "./sqlite-driver.js";
import { EVIDENCE_SCHEMA } from "../evidence/schema.js";

/** Rebuild constrained tables transactionally with FK enforcement restored and checked. */
export function migrateCurrentIngestion(database: Database): void {
	if (
		database
			.query("SELECT 1 FROM _sensei_migrations WHERE id = ?")
			.get("0004_current_ingestion")
	)
		return;
	const tables = database
		.query(
			"SELECT name, sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL",
		)
		.all() as { name: string; sql: string }[];
	const affected = tables.filter((t) =>
		/IN\s*\('claude',\s*'codex'\)/.test(t.sql),
	);
	for (const table of affected) {
		const sequence = /AUTOINCREMENT/i.test(table.sql)
			? (database
					.query("SELECT seq FROM sqlite_sequence WHERE name=?")
					.get(table.name) as { seq: number } | null)
			: null;
		const dependents = database
			.query(
				"SELECT sql FROM sqlite_master WHERE tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL",
			)
			.all(table.name) as { sql: string }[];
		const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
		const replacement = `__sensei_${table.name}`;
		const sql = table.sql
			.replace(
				/CREATE TABLE\s+(?:"[^"]+"|\w+)/i,
				`CREATE TABLE ${quote(replacement)}`,
			)
			.replaceAll(
				/IN\s*\('claude',\s*'codex'\)/g,
				"IN ('claude','codex','copilot')",
			);
		database.exec(sql);
		database.exec(
			`INSERT INTO ${quote(replacement)} SELECT * FROM ${quote(table.name)}`,
		);
		database.exec(`DROP TABLE ${quote(table.name)}`);
		database.exec(
			`ALTER TABLE ${quote(replacement)} RENAME TO ${quote(table.name)}`,
		);
		if (sequence)
			database
				.query("UPDATE sqlite_sequence SET seq=max(seq,?) WHERE name=?")
				.run(sequence.seq, table.name);
		for (const dependent of dependents) database.exec(dependent.sql);
	}
	database.exec(EVIDENCE_SCHEMA);
	database
		.query("INSERT INTO _sensei_migrations VALUES (?,?)")
		.run("0004_current_ingestion", new Date().toISOString());
}
