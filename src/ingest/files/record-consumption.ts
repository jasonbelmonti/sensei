// Adapted from Claudex 4.0.6 (MIT); see THIRD_PARTY_NOTICES.md.
import type { IngestCursor, ObservedIngestRecord } from "../contracts.js";

export type RecordConsumptionResult = {
  latestCursor: IngestCursor | null;
  parseError: unknown | null;
  consumerError: unknown | null;
};

export async function consumeParsedRecords(options: {
  initialCursor: IngestCursor | null;
  records: AsyncIterable<ObservedIngestRecord>;
  onRecord: (record: ObservedIngestRecord) => Promise<void>;
}): Promise<RecordConsumptionResult> {
  const iterator = options.records[Symbol.asyncIterator]();
  let latestCursor = options.initialCursor;
  let pendingLine: IngestCursor | null = null;

  while (true) {
    let nextRecord: IteratorResult<ObservedIngestRecord>;

    try {
      nextRecord = await iterator.next();
    } catch (error) {
      return {
        latestCursor,
        parseError: error,
        consumerError: null,
      };
    }

    if (nextRecord.done) {
      return {
        latestCursor: pendingLine ?? latestCursor,
        parseError: null,
        consumerError: null,
      };
    }

    // JSONL readers can emit several observations at one byte offset, including
    // a final session observation. Acknowledge that line only after the entire
    // group succeeds. Snapshot records instead carry explicit replay indexes.
    if (
      pendingLine &&
      nextRecord.value.cursor?.byteOffset !== pendingLine.byteOffset
    ) {
      latestCursor = pendingLine;
      pendingLine = null;
    }

    try {
      await options.onRecord(nextRecord.value);
    } catch (consumerError) {
      try {
        await iterator.return?.();
      } catch {
        // Preserve the original consumer failure and the last committed cursor
        // even when iterator cleanup also fails.
      }

      return {
        latestCursor,
        parseError: null,
        consumerError,
      };
    }

    if (nextRecord.value.source.kind === "snapshot") {
      latestCursor = nextRecord.value.cursor ?? latestCursor;
    } else {
      pendingLine = nextRecord.value.cursor ?? pendingLine;
    }
  }
}
