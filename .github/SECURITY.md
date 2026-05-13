# Security Policy

## Scope

Sovri handles two security-sensitive surfaces:

1. **GitHub App credentials and webhooks** — the bot holds write-scoped tokens to client repositories.
2. **LLM prompt injection via user diffs** — content from pull requests enters LLM prompts.

Reports about either are explicitly in scope. The following are also in scope:

- Authentication or authorization bypass on the bot or any future Cloud surface.
- Leakage of GitHub App credentials, LLM API keys, or webhook payloads through logs or error messages.
- Supply-chain compromise (malicious dependency, tampered release artifact, broken signing chain).
- Sandbox escape allowing code from a user diff or LLM response to execute on the bot host.
- Bypass of the Apache 2.0 / proprietary Cloud boundary (e.g. unintended import of `apps/cloud-api/` from a Community surface).

### Out of Scope

The following are not eligible for coordinated disclosure and should be filed as regular issues, or in some cases reported elsewhere:

- Best-practice hardening suggestions without a concrete exploit path (file a regular issue).
- Vulnerabilities in third-party dependencies that already have a patched version available — open a PR to bump the dependency instead.
- Denial-of-service attacks that require unrealistic request volumes already mitigated by GitHub-side rate limiting.
- Issues that require a previously compromised maintainer machine, a hostile GitHub organization owner, or a malicious LLM provider — these are outside the threat model.
- Social engineering or phishing of maintainers (report directly to GitHub Trust & Safety).
- Vulnerabilities in the proprietary Cloud edition (`apps/cloud-api/`) — that codebase is not published in this repository and has its own private disclosure channel that will be documented once Cloud reaches general availability.
- Findings that depend on unsupported configurations (e.g. disabling `ignore-scripts`, running the bot with elevated privileges, exposing the webhook endpoint without HMAC validation).

## Supported Versions

Until the v1.0 release, only the `main` branch is supported. Post-v1.0 the latest minor and the previous minor are supported.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Use one of these private channels:

1. **GitHub Security Advisories** — preferred. Open a draft advisory at https://github.com/mpiton/sovri/security/advisories/new
2. **Email** — `matpiton@protonmail.com`. PGP encryption is supported; the public key and its fingerprint will be published in this file before the v0.1 release. Until then, request the key by email and verify the fingerprint out-of-band before sending sensitive material.

   ```
   PGP fingerprint: TBD — published before v0.1
   ```

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

Sovri pins exact versions for LLM SDKs and security-critical dependencies (no `^` / `~`), runs `pnpm audit` on every PR, blocks dependency `postinstall` scripts via `ignore-scripts=true`, and publishes a CycloneDX SBOM with every release.
