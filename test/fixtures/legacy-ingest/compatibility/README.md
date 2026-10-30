# Legacy ingestion fixtures

Frozen before the service replacement against Sensei `98777126ab47d20f57af7704f288725ab7ed0b3b` and Claudex 4.0.6. These synthetic files cover Claude JSONL, Claude snapshot/task JSON, Codex transcript JSONL and Codex session-index JSONL. Expectations were checked against the input fields and the incumbent production scan/watch storage paths.

The captures preserve all stored semantic fields, including canonical/provisional identities, source precedence and locations, two Codex turns (completed and aborted), two tools (success and error), token usage and the unsupported-record warning. The Claude parser's missing turn IDs remain a documented limitation; these captures do not qualify Claude turn reconstruction or current Codex fidelity.

`legacy-cursors.json` retains incumbent cursor offsets and parser metadata. Tests may relocate paths and replace filesystem fingerprint/mtime with those of identical copied bytes. Unversioned or incompatible state must visibly replay safely. Owned cursors must resume without losing pending turn/tool state.

`legacy-storage.fixture.ts` enumerates the only canonicalization: replace the disposable root with `<fixture>`; normalize generated SQL `updated_at`, `detected_at`, and `observed_at` values without an explicit fixture timestamp. JSON columns retain every semantic field. Cursor transport metadata is checked separately from the stored observation comparison.

The incumbent's loss of an incomplete final JSONL record is a defect, not an expected result. Partial-line completion, failed callbacks, cursor resets, rotation/truncation and shutdown have separate behavioral tests.
