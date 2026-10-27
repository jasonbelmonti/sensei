import BetterSqlite3 from "better-sqlite3";

type DatabaseOptions = {
	readonly?: boolean;
	create?: boolean;
};

/** Synchronous SQLite operations used by Sensei's repositories and migrations. */
export class Database {
	private readonly connection: BetterSqlite3.Database;

	constructor(path: string, options: DatabaseOptions = {}) {
		this.connection = new BetterSqlite3(path, {
			readonly: options.readonly ?? false,
			fileMustExist: options.readonly || options.create === false,
			timeout: 5000,
		});
	}

	query(sql: string) {
		const statement = this.connection.prepare<unknown[], unknown>(sql);

		return {
			get: (...parameters: unknown[]): unknown | null =>
				statement.get(...parameters) ?? null,
			all: (...parameters: unknown[]): unknown[] =>
				statement.all(...parameters),
			run: (...parameters: unknown[]): BetterSqlite3.RunResult =>
				statement.run(...parameters),
		};
	}

	exec(sql: string): void {
		this.connection.exec(sql);
	}

	transaction<Parameters extends unknown[], Result>(
		callback: (...parameters: Parameters) => Result,
	): (...parameters: Parameters) => Result {
		return this.connection.transaction(callback);
	}

	close(): void {
		this.connection.close();
	}
}
