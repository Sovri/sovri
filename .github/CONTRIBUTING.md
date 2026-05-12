# Contributing to Sovri

Thanks for considering a contribution. Sovri is a sovereign AI code-review platform for regulated EU enterprises. Every contribution — bug report, feature proposal, or pull request — is welcome.

Before opening a substantial change, please skim `PRD.md` (product scope) and `ARCHI.md` (technical contracts) so the proposal stays inside the project's locked decisions.

## How to Contribute

### Reporting Bugs

1. Search existing [Issues](https://github.com/mpiton/sovri/issues) for duplicates.
2. Open a new issue with the **Bug Report** template.
3. Include reproduction steps, expected vs actual behavior, and the relevant `delivery_id` from logs if the bot misbehaved on a real PR.

### Suggesting Features

1. Check the [non-objectives section of the PRD](https://github.com/mpiton/sovri/blob/main/PRD.md) — many "obvious" features are intentionally out of scope (SAST engine, DORA metrics, IDE plugin, multi-repo context, etc.).
2. Open an issue with the **Feature Request** template and explain the user problem before the proposed solution.

### Pull Requests

1. Fork the repository and create a feature branch (`git checkout -b feat/<scope>-short-title`).
2. Follow the TDD cycle described in `CLAUDE.md` — write failing tests first.
3. Keep changes focused; do not bundle refactors with feature work.
4. Update `CHANGELOG.md` under `[Unreleased]` (Keep a Changelog 1.1 format).
5. Commit with Conventional Commits (see below).
6. Push and open a pull request against `main`; the PR template walks you through the rest.

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]
```

- **Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `build`
- **Scopes**: `core`, `review-engine`, `llm-providers`, `config`, `observability`, `bot`, `cloud`, `ci`, `hooks`, `docs`, `deps`, `release`

Example: `feat(review-engine): add SARIF ingester with dedup heuristics`

## Development Setup

### Prerequisites

- Node.js LTS 24.x (see `.nvmrc` once published)
- pnpm 10 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker (for integration tests and local bot runs)

### Bootstrap

```bash
git clone git@github.com:mpiton/sovri.git
cd sovri
pnpm install --frozen-lockfile
pnpm exec lefthook install
```

### Common commands

```bash
pnpm --filter @sovri/community-bot dev   # bot in watch mode
pnpm turbo build                         # build all packages and apps
pnpm exec vitest run                     # full test suite
pnpm exec vitest run --coverage          # with coverage gates
pnpm exec oxlint .                       # lint
pnpm exec oxfmt --check .                # format check
pnpm exec tsc -b                         # workspace type-check
```

## Project Rules (non-negotiable)

- **pnpm only** — no `npm`, `yarn`, or `bun`. Add dependencies with `pnpm add`, never by editing `package.json` directly.
- **ESM only** — no CommonJS, no `require()`.
- **TypeScript strict** — no `any`, no unchecked `as`, no `@ts-ignore` / `@ts-expect-error`. Fix the root cause.
- **oxlint + oxfmt** — no ESLint, Prettier, or Biome.
- **Zod at every external boundary** — webhook payloads, LLM responses, and `.sovri.yml` are validated.
- **English only in code** — identifiers, types, log and error messages, comments.
- **No `--no-verify`** — pre-commit and pre-push hooks must pass.

See `CLAUDE.md` for the complete list.

## Licensing

By contributing you agree that your contributions are licensed under the [Apache License 2.0](../LICENSE), the license of the Sovri Community edition. Contributions targeted at the proprietary Cloud edition are not accepted via this repository.

## Code of Conduct

By participating you agree to behave respectfully and constructively. Harassment, discrimination, or hostile conduct will not be tolerated. A formal `CODE_OF_CONDUCT.md` will be adopted before the v1.0 release.

## Questions?

Open a [Discussion](https://github.com/mpiton/sovri/discussions) or file an issue using the **Question** template.
