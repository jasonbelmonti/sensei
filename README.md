# sensei

`sensei` is a local history-analysis prototype. The reboot targets related completed tasks and supporting evidence from Codex and Copilot.

## v0 direction

The existing v0 prototype has these layers; task retrieval is the reboot target:

1. Ingest local Codex and Copilot artifacts (with retained legacy Claude readers) through Sensei-owned readers.
2. Persist a canonical local history under `~/.sensei`.
3. Extract deterministic prompt and workflow features.
4. Group repeated work into stable workflow families.
5. Rank useful insights and generate reviewable draft artifacts.
6. Expose the results through a CLI plus a repo-local `sensei` skill.

## Architecture boundaries

The repository is organized around these top-level areas:

- `src/analysis`: deterministic feature extraction, grouping, and scoring
- `src/cli`: operator-facing command entrypoints
- `src/config`: runtime paths and configuration seams
- `src/drafting`: draft skill/script/automation generation
- `src/evidence`: immutable visible observations, source versions and locators
- `src/ingest`: local readers, file continuity, scan/watch scheduling and canonical mapping
- `src/reporting`: report rendering over stored insights
- `src/storage`: local persistence and migrations

## Owned ingestion

Sensei owns passive ingestion and requires no provider SDK, authentication or
model/network call to scan local files. The required compatibility inputs are
Codex JSONL transcripts and session indexes (`session_index.jsonl` or
`session-index.jsonl`). Legacy Claude readers remain in the tree; Claude repair
and qualification are outside the reboot scope. Selected
decoding logic was adapted under the MIT license; see [attribution](THIRD_PARTY_NOTICES.md).

Current Codex rich `item_completed` records and version-1 Copilot Agent
`events.jsonl` logs are supported. Visible human/assistant messages and supported
tool outcomes are stored as immutable evidence with session, turn and item IDs,
source SHA-256 and decoded line/byte locations. Model-input envelopes, transformed
Copilot prompts, system instructions and hidden reasoning are excluded from this
evidence. Human messages that discuss instructions remain valid requests.

Codex `.jsonl.zst` archives require `zstd` on PATH. Decoding and record staging
use private temporary files; archive evidence and its cursor publish only after
successful decoding, in one transaction. Plain sources publish bounded batches
with their cursor. Plain/compressed copies share logical observations and retain
both locators. Rewritten sources retain earlier evidence and advance source
generations. Tool errors are observations; a search miss alone does not establish
workflow friction. Wrapper outcomes and leaf outcomes remain separate.

The scan summary reports discovered/read/skipped/partial sources and visible
message/tool totals. Unknown item kinds, malformed records and metadata-only
Copilot sessions report incomplete coverage. Supported Copilot input is local
`events.jsonl`, not derived SQLite, remote history or metadata-only sessions.
External URLs in evidence remain unverified references; ingestion does not fetch
them. Completed-task records and task retrieval are not implemented yet.

Use a separate home for this reboot; existing legacy rows are preserved by the
transactional provider/evidence schema migration:

```sh
SENSEI_HOME=/absolute/path/to/sensei-reboot-home \
SENSEI_CODEX_ROOT=/absolute/path/to/codex-sources \
SENSEI_COPILOT_ROOT=/absolute/path/to/copilot/session-state \
npm run sensei -- ingest scan
```

Both `ingest scan` and `ingest watch` use the owned service. Unverified legacy
cursors, changed reader versions and rewritten/rotated sources produce visible
reset warnings and replay through idempotent storage. Incomplete final JSONL
records stay pending until completed. Newline-terminated malformed records
produce warnings; later records remain readable. Watch ticks serialize, failed
writes do not acknowledge the failed observation, and shutdown waits for active
processing. A `watch-failed` warning requires restarting the watcher.

Codex transcript reader version 3 retries final session delivery before
acknowledging the last line, including after a failed callback and restart.
Earlier transcript cursors replay once with a `cursor-reset` warning, including
unchanged files at EOF. Existing stored records are upserted without duplication.

SQLite schemas and CLI configuration are unchanged. Use an explicit isolated
`SENSEI_HOME` when evaluating this reboot; no default database conversion is part
of this release. Source-specific warnings are retained in `ingest_warnings`.

## Runtime and development

Use Node.js **24.22.1** and its bundled npm **11.19.1**. The repository pins
the runtime in `.node-version` and dependencies in `package-lock.json`.
SQLite uses the native `better-sqlite3` binding; installation needs its
platform binary or a working native build toolchain. The qualification
environment also includes the standard `zstd` command (1.5.7).

```bash
npm ci
npm run check
npm run sensei -- --help
```

`npm run check` runs lint, typecheck, the build and tests. `npm test` also
builds first. After editing source, run `npm run build` before using the CLI:
`npm run sensei -- ...` executes compiled JavaScript from `dist/`.

## Runtime path defaults

The current runtime/config layer assumes a local-first layout:

- `~/.sensei` for runtime-owned data, cache, reports, and the local SQLite database
- `~/.claude` and `~/.codex` as the default provider roots
- `<repo>/generated` as the workspace-owned output root for generated skills, scripts, and automation specs

The initial env overrides are:

- `SENSEI_HOME`
- `SENSEI_CLAUDE_ROOT`
- `SENSEI_CODEX_ROOT`
- `SENSEI_COPILOT_ROOT` (defaults to `~/.copilot/session-state`)
- `SENSEI_GENERATED_ROOT`
- `SENSEI_INGEST_WATCH_INTERVAL_MS`
- `SENSEI_EMBEDDING_PROVIDER`

## Current status

This repository now contains the ingest and storage foundation for canonical local history, along with focused verification for the scan/watch/store contract. Analysis, reporting, drafting, and the higher-level mentoring behavior still land in subsequent issues.

## CLI bootstrap surface

After `npm ci` and `npm run build`, the package-level bootstrap path is:

```bash
npm run sensei -- --help
```

The registered command groups are:

- `ingest`: backfill or observe local Claude and Codex history
- `analyze`: run deterministic feature extraction and mentoring analysis
- `report`: render operator-facing summaries over stored insights
- `draft`: prepare reviewable draft skills, scripts, and automations

The ingest command group is live today:

- `npm run sensei -- ingest scan` backfills canonical sessions, turns, usage, tool events, cursors, and warnings into the local store
- `npm run sensei -- ingest watch` starts the long-running watch seam and persists appended provider history into the same store

The `analyze`, `report`, and `draft` command groups still use placeholder shells in the current slice. Each dispatches through the CLI wiring, then exits non-zero with:

- `Command group '<name>' is not implemented yet.`
- `Command dispatch is active; '<name>' still uses a placeholder shell.`

Current bootstrap behavior:

- `npm run sensei -- --help` succeeds and renders the registered command groups
- `npm run sensei -- <command>` dispatches to the matching shell module
- unknown commands exit with code `1`

## Verification

```bash
npm ci
npm run check
npm run sensei -- --help
```
