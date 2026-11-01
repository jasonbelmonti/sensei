import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/** Bounded framing. A malformed unterminated tail is pending, not a corrupt middle line. */
export async function* streamJsonl(
	path: string,
	start = 0,
	end?: number,
	startLine = 1,
) {
	if (end !== undefined && start >= end) return;
	const hash = createHash("sha256");
	if (start > 0)
		for await (const chunk of createReadStream(path, {
			start: 0,
			end: start - 1,
		}))
			hash.update(chunk);
	const stream = createReadStream(path, {
		start,
		end: end === undefined ? undefined : end - 1,
		highWaterMark: 64 * 1024,
	});
	let pending = Buffer.alloc(0);
	let offset = start;
	let line = startLine;
	try {
		for await (const chunk of stream) {
			pending = Buffer.concat([pending, chunk as Buffer]);
			let boundary = pending.indexOf(10);
			while (boundary !== -1) {
				const bytes = pending.subarray(0, boundary + 1);
				offset += bytes.length;
				hash.update(bytes);
				yield {
					text: bytes.toString("utf8").trim(),
					line: line++,
					offset,
					terminated: true,
					token: hash.copy().digest("hex"),
				};
				pending = pending.subarray(boundary + 1);
				boundary = pending.indexOf(10);
			}
			if (pending.length > 64 * 1024 * 1024)
				throw new Error("JSONL record exceeds 64 MiB limit");
		}
		if (pending.length) {
			hash.update(pending);
			yield {
				text: pending.toString("utf8").trim(),
				line,
				offset: offset + pending.length,
				terminated: false,
				token: hash.copy().digest("hex"),
			};
		}
	} finally {
		stream.destroy();
	}
}
