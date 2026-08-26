# ADR 0002 — TypeScript everywhere, one monorepo

**Status:** accepted · 2026-08-26

## Context

The app needs a rules engine, an AI, statistical analysis, a rich UI, and a
desktop shell. Rust was considered for the engine and evaluator on performance
grounds.

## Decision

One pnpm monorepo, TypeScript for everything shipped. Rust appears only as
Tauri's shell (ADR 0003). Model training, if it happens, is offline Python.

## Why

- With gnubg as the evaluator (ADR 0004), no shipped code is compute-bound.
- One language means any agent can run `pnpm check` and exercise the entire
  system. No cross-compilation, no WASM build step in the inner loop, no
  bindings to keep in sync. For an agent-driven project this is worth more than
  raw speed we do not need.
- The engine is pure and allocation-light, which keeps a future WASM port of any
  hot function trivial.

## Consequences

- Full rollouts in JS are not viable. Accepted: rollouts are delegated to gnubg.
- **Rejected in advance:** rewriting the application in Rust. If a hot path ever
  needs native speed, the remedy is compiling *that function* to WASM behind the
  existing interface. Anyone proposing a broader rewrite should be pointed here.
