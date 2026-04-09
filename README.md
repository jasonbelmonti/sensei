# sensei

`sensei` is a local-first mentoring system for analyzing how work gets done with Claude and Codex, surfacing recurring patterns, and proposing higher-leverage workflows.

## v0 direction

The v0 system is intentionally split into small, explicit layers:

1. Ingest local Claude and Codex artifacts through `@jasonbelmonti/claudex/ingest`.
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
- `src/ingest`: `claudex`-backed observation and canonical mapping
- `src/reporting`: report rendering over stored insights
- `src/storage`: local persistence and migrations

## Relationship to `claudex`

`sensei` should consume `@jasonbelmonti/claudex/ingest` as the canonical normalization layer for Claude and Codex artifacts. The goal is to build mentoring and workflow analysis on top of normalized turns, not to duplicate transcript parsing logic here.

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

This repository currently contains the initial Bun/TypeScript scaffold and smoke coverage for the bootstrap layer. Ingest, storage, analysis, and the final skill behavior land in subsequent issues.

## Verification

```bash
bun install
bun run check
```
