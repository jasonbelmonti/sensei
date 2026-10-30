import {
	appendFileSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readJsonlSlice } from "../../src/ingest/files/read-slice.js";

const fixture = readFileSync(
	new URL("../fixtures/copilot-framing/events.jsonl", import.meta.url),
);

// This qualifies the shared file boundary, not a Copilot provider adapter.
test("Copilot JSONL framing retains a split Unicode record until append", async () => {
	const root = mkdtempSync(join(tmpdir(), "sensei-copilot-framing-"));
	try {
		const file = join(root, "events.jsonl");
		const completed = fixture.indexOf(10) + 1;
		const split = fixture.indexOf(Buffer.from("🔍")) + 2;
		expect(split).toBeGreaterThan(completed);
		writeFileSync(file, fixture.subarray(0, split));
		let incomplete = 0;
		const warn = async () => {
			incomplete += 1;
		};
		const first = await readJsonlSlice(file, 0, warn);
		expect(first.bytes).toEqual(fixture.subarray(0, completed));
		const resumed = await readJsonlSlice(file, completed, warn);
		expect(resumed.bytes.length).toBe(0);
		expect(incomplete).toBe(2);

		appendFileSync(file, fixture.subarray(split));
		const completedTail = await readJsonlSlice(file, completed, warn);
		expect(completedTail.bytes).toEqual(fixture.subarray(completed));
		expect(JSON.parse(completedTail.bytes.toString("utf8"))).toMatchObject({
			id: "event-2",
			type: "user.message",
			data: { content: "Inspect café 🔍", turnId: "turn-1" },
		});
		expect(completed + completedTail.bytes.length).toBe(fixture.length);
		expect(incomplete).toBe(2);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
