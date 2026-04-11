---
name: sensei
description: Repo-local mentoring surface for the Sensei workflow analysis system. Use when a task should be routed through the local-first Sensei skill shell or grounded in Sensei-generated mentoring artifacts.
---

# Sensei

Use this skill as the repo-local mentoring surface for `sensei`. In v0, the skill stays intentionally lean: it establishes the invocation point that later tickets will connect to generated mentoring guidance, workflow analysis, and draft outputs.

## When to use

- The user explicitly asks to use the repo-local `sensei` skill.
- The task should be framed around local-first mentoring or workflow analysis produced by this repository.
- You need the stable skill surface that later `sensei` outputs will target.

## Current scope

- Treat this skill as a shell, not the final mentoring workflow.
- Prefer factual guidance grounded in current repository state and generated `sensei` artifacts once they exist.
- Do not invent mentoring analysis that has not been produced by the system yet.

## Invocation

- Invoke with `$sensei` when the task should use the repo-local mentoring surface.
- Use `bun run sensei -- --help` to inspect the current CLI shell while the command groups remain placeholder wiring.
