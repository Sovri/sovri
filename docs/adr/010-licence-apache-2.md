# ADR-010 — Apache 2.0 license on Community code

**Status:** Accepted
**Date:** 2026-05-12

## Context

Sovri follows an open-core model: open-source Community edition + proprietary Cloud edition. The Community code must be published under an open-source license compatible with:

- Enterprise adoption (no strong copyleft that would scare CTOs).
- Minimal project protection (patent clause).
- The commercial model (allowing proprietary Cloud on top).
- Use by competitors (acceptable, it's the price of trust from sovereignty-focused clients).

Alternatives evaluated: MIT, Apache 2.0, BSD-3, MPL 2.0, AGPL, BSL (Business Source License).

## Decision

**Apache 2.0** on all `packages/*` and `apps/community-bot/`.

`apps/cloud-api/` remains proprietary (not published under Apache 2.0).

`LICENSE` file at the repo root.

Copyright notice in the header of each published source file:

```typescript
// Copyright 2026 Sovri contributors
// SPDX-License-Identifier: Apache-2.0
```

## Rationale

- **Explicit patent clause**: protects against a contributor who would contribute code covered by a patent they hold and then try to enforce it. MIT does not have this protection.
- **Standard for modern dev tooling**: Kubernetes, Terraform, OpenSearch, Vault, OpenTelemetry — all Apache 2.0. Enterprise CTOs recognize the license without hesitation.
- **Compatible with open-core**: Apache 2.0 only applies to code explicitly published under this license. Cloud code remains 100% proprietary, even if it imports the open-source `packages/*`.
- **Allows commercial use**: clients can integrate Sovri Community into their own proprietary products. Does not slow down adoption.
- **Broad compatibility**: Apache 2.0 is compatible with nearly all other open-source licenses (except strict GPL v2).

## Consequences

- Apache 2.0 provides **no protection against hostile forks**. Mitigation: fast cadence on Community, capitalization on brand and client relationships for Cloud.
- Cloud code remains 100% ours, with no sharing constraints, even if it uses/imports our own Community.
- Check the licenses of **third-party dependencies** (npm packages, libraries). An AGPL dependency would force opening; MIT/Apache/BSD impose nothing. Rarely a problem in the Node.js ecosystem, but to check when choosing a lib.
- Mandatory license header in each published `.ts` source file.
- `NOTICE` to include if we integrate third-party Apache 2.0 code.

## Rejected alternatives

- **MIT**: more permissive but no patent clause. Real legal risk on a project that touches regulated client code.
- **BSD-3**: functional equivalent of MIT, same limitations.
- **MPL 2.0**: file-level copyleft, requires opening modifications file by file. Too restrictive for occasional external contributors.
- **AGPL**: strong copyleft that extends to network services. Would kill Enterprise adoption (most CTOs refuse AGPL internally). To evaluate for Community only if we want to force commercial users onto Cloud — but this contradicts the Community adoption strategy.
- **BSL (Business Source License)**: commercial-clause license with deferred open-source transition. Complicated to explain, upsets the OSS community, bad signal for an early-stage startup.
