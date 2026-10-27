# sensei

`sensei` is a local-first mentoring system for analyzing how work gets done with Claude and Codex, surfacing recurring patterns, and proposing higher-leverage workflows.

## v0 direction

The v0 system is intentionally split into small, explicit layers:

1. Ingest local Claude and Codex artifacts through Sensei-owned readers.
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
- `src/ingest`: local readers, file continuity, scan/watch scheduling and canonical mapping
- `src/reporting`: report rendering over stored insights
- `src/storage`: local persistence and migrations

## Owned ingestion

Sensei owns passive ingestion and requires no provider SDK, authentication or
model/network call to scan local files. The supported compatibility inputs are
Claude JSONL transcripts and JSON snapshots/tasks, plus Codex JSONL transcripts
and session indexes (`session_index.jsonl` or `session-index.jsonl`). Selected
decoding logic was adapted under the MIT license; see [attribution](THIRD_PARTY_NOTICES.md).

The readers preserve the existing normalization contract. Claude turn IDs and
current Codex rich `item_completed` fidelity remain separate work; this release
does not qualify complete evidence retrieval from those formats.

Both `ingest scan` and `ingest watch` use the owned service. Unverified legacy
cursors, changed reader versions and rewritten/rotated sources produce visible
reset warnings and replay through idempotent storage. Incomplete final JSONL
records stay pending until completed. Newline-terminated malformed records
produce warnings; later records remain readable. Watch ticks serialize, failed
writes do not acknowledge the failed observation, and shutdown waits for active
processing. A `watch-failed` warning requires restarting the watcher.

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
