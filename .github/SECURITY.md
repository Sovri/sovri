# Security Policy

## Scope

Sovri handles two security-sensitive surfaces:

1. **GitHub App credentials and webhooks** — the bot holds write-scoped tokens to client repositories.
2. **LLM prompt injection via user diffs** — content from pull requests enters LLM prompts.

Reports about either are explicitly in scope. Reports about general best-practice hardening that do not have a concrete exploit path are welcome via regular issues.

## Supported Versions

Until the v1.0 release, only the `main` branch is supported. Post-v1.0 the latest minor and the previous minor are supported.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Use one of these private channels:

1. **GitHub Security Advisories** — preferred. Open a draft advisory at https://github.com/mpiton/sovri/security/advisories/new
2. **Email** — `matpiton@protonmail.com` (PGP key available on request)

### What to Include

- Affected component (community-bot, packages/review-engine, llm-providers, config, …)
- Vulnerability class (auth bypass, prompt injection, secret leak, supply chain, …)
- Reproduction steps with a minimal proof-of-concept
- Impact assessment (data exposure, code execution, escalation path)
- Suggested fix or mitigation if you have one

### Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial triage and severity**: within 5 business days
- **Fix or coordinated disclosure plan**: depends on severity; critical issues are patched and released as soon as a fix is validated

Reporters are credited in the published advisory unless they request to remain anonymous.

## Supply Chain

Sovri pins exact versions for LLM SDKs and security-critical dependencies (no `^` / `~`), runs `pnpm audit` on every PR, blocks dependency `postinstall` scripts via `ignore-scripts=true`, and publishes a CycloneDX SBOM with every release. See `ARCHI.md §9` for the full supply-chain hardening posture.
