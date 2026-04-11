import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { migrateSenseiDatabase } from "./migrations";
import { createConversationRepository } from "./repositories/conversations";
import { createIngestStateRepository } from "./repositories/ingest-state";

export type OpenSenseiStorageOptions = {
  databasePath: string;
  readonly?: boolean;
};

export type SenseiStorage = ReturnType<typeof openSenseiStorage>;

export function openSenseiStorage(options: OpenSenseiStorageOptions) {
  if (!options.readonly) {
    mkdirSync(dirname(options.databasePath), { recursive: true });
  }

  const database = new Database(options.databasePath, {
    readonly: options.readonly ?? false,
    create: !options.readonly,
  });

  configureDatabase(database);
  const migrations = options.readonly ? [] : migrateSenseiDatabase(database);
  const conversations = createConversationRepository(database);
  const ingestState = createIngestStateRepository(database);

  return {
    database,
    migrations,
    conversations,
    ingestState,
    transaction<T>(callback: (storage: {
      conversations: typeof conversations;
      ingestState: typeof ingestState;
    }) => T): T {
      const runTransaction = database.transaction(() =>
        callback({
          conversations,
          ingestState,
        }),
      );

      return runTransaction();
    },
    close() {
      database.close();
    },
  };
}

function configureDatabase(database: Database): void {
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
}
