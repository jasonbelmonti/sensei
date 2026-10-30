# Copilot JSONL framing fixture

`events.jsonl` uses the event envelope and field types observed in local Copilot
agent logs on 2026-10-30: `type`, `data`, `id`, `timestamp`, and `parentId`.
The two records represent `session.start` and `user.message` (format version 1).
All identifiers, timestamps and message text are synthetic. The private source
locator, digest and structural observation are retained in the execution capsule.

This fixture proves only shared file framing, including interrupted multibyte
characters and append/restart. It does not qualify a Copilot provider reader,
message normalization, storage, completion, desktop/remote history, or retrieval.
Those require independent source expectations and production scan tests in the
current-format ingestion phase. Preserve `data.content` as the eventual visible
request; `transformedContent` is intentionally different and must be excluded.
