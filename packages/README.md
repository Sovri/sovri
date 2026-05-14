<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Sovri SAS
-->

# `packages/` — Sovri Community workspace

Reserved for the Apache 2.0 community packages enumerated in
`ARCHI.md` §3-4. Each package init task (#21 `observability`,
#24 `config`, #27 `llm-providers`, #31 `review-engine`, plus
`core` and the shared bot under `apps/community-bot/`) materialises
its own `package.json` under this directory and registers itself
as a Turborepo workspace member via the `packages/*` glob in
`pnpm-workspace.yaml`.

This README acts as the workspace anchor until the first package
lands: it keeps the directory present in `git` (empty directories
are not tracked), it satisfies the universal Apache 2.0 header
rule in `.claude/rules/30-licensing.md`, and it lets the pre-push
`pnpm turbo build --filter='./packages/*'` command resolve its
filter to an empty workspace set rather than aborting with
`Directory ... specified in filter does not exist`. Delete this
file in the PR that introduces the first real workspace member.
