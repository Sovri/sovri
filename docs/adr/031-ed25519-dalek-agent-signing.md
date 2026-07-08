# ADR-031 — ed25519-dalek for agent-side compliance-export signing

**Status:** Accepted
**Date:** 2026-07-08

## Context

The compliance pivot (MAT-113) makes `sovri-agent` run framework controls against a project and
derive `ControlResult` / `ComplianceGap` output air-gapped (ADR-023), with SHA-256 evidence
integrity (MAT-92/93) and MAT-87 scores. V0.6 turns that corpus into exportable artifacts. Two of
the three exports — the MAT-95 PDF and the MAT-96 spreadsheet — are human-facing and `std`-only.
The third, MAT-97, is the machine-readable export: a versioned, canonicalized JSON document that a
downstream audit pipeline must be able to verify offline and detect tampering on, without contacting
Sovri.

Offline tamper detection needs an asymmetric signature. ADR-014 already chose Ed25519 as the org's
signature primitive for the Compliance Trail, but implemented it with Node.js native `node:crypto` —
available in the TypeScript bot, absent in the Rust agent. The Rust standard library has no
asymmetric signature primitive.

`sovri-agent` has carried no third-party runtime dependency to date (only the in-house `sovri-sdk`).
MAT-93 deliberately hand-rolled SHA-256 in `std` to avoid one. That precedent does not extend here:
a hash of that form is defensible to implement in-house, but an elliptic-curve signature is not —
hand-rolling Ed25519 (constant-time field arithmetic, scalar clamping, cofactor and malleability
handling) is a known source of critical vulnerabilities. The agent also inherits the org's
supply-chain posture for a regulated-enterprise target: exact version pins, cargo-deny, SBOM, and a
minimum soak period before adopting a dependency version.

## Decision

The `sovri-agent` compliance export (MAT-97) signs and verifies with Ed25519 from the
`ed25519-dalek` crate. This is the agent's first admitted third-party runtime dependency. The curve
is not hand-rolled.

The dependency is confined to `sovri-agent`. `sovri-sdk-rust` stays zero-third-party: the SDK keeps
providing the hand-rolled SHA-256 (MAT-93) that produces the digest the signature covers, so the
shared contract library gains no crypto surface.

Supply-chain controls on the crate:

- Pinned exactly (`=2.2.0`, no `^` / `~`), `Cargo.lock` committed, `--locked` in CI.
- The mature 2.2.x line is chosen over the freshly released 3.0.0 (2026-07-06) on purpose. A
  dependency version soaks before adoption; 3.0.0 has not, and 2.2.x covers the need. Moving to 3.x
  is a later, explicit decision.
- License BSD-3-Clause — permissive and Apache-2.0-compatible — added to the cargo-deny allowlist.
  cargo-deny also runs advisory (RustSec) and source (crates.io only) checks over the whole graph.
- Admitting `ed25519-dalek` admits its transitive tree (curve25519-dalek, ed25519, signature, sha2,
  subtle, zeroize, …) — the standard dalek / RustCrypto crates. cargo-deny gates the full graph and
  the SBOM records it; "one crate" means one signature primitive, not one node.

Key handling stays as ADR-014 set it: callers inject key material; signing is deterministic
(RFC 8032, no per-signature RNG), so a fixed key yields byte-identical artifacts. Only the public
key travels in the export — no private key material is ever embedded (MAT-97 R-09). Key generation,
storage, and rotation remain out of scope.

The embedded public key gives **integrity**, not **authenticity**. It makes any tampering relative to
that key detectable, but it does not prove Sovri produced the artifact: an attacker who rewrites the
whole document can re-sign it with their own keypair and embed the matching key, and the signature
still checks out. Authenticity is the verifier's out-of-band trust decision — it compares the
`key_id` / public key against a known-good Sovri key, and (as ADR-014 already allows) can pass an
expected key that verification must match and reject on mismatch. The embedded metadata makes the
integrity check self-contained and offline (MAT-97 R-05); it is deliberately not a substitute for
that trust anchor.

## Rationale

- Ed25519 was already the chosen primitive (ADR-014): fast, compact keys and signatures, no
  signature-time randomness pitfalls, offline-verifiable. This ADR only supplies it to the Rust
  agent, which has no native implementation.
- `ed25519-dalek` is the de-facto standard Rust Ed25519 implementation — constant-time, RFC 8032,
  widely deployed and audited. Depending on it is the safe answer to "do not hand-roll the curve."
- Deterministic signing keeps the export reproducible and snapshot-testable, which the byte-identical
  canonicalization (MAT-97) and the offline-verification property (ADR-023) both require.
- Keeping the crate agent-side preserves the SDK's zero-dependency contract, so no downstream SDK
  consumer inherits a crypto dependency it does not use.

## Consequences

- The agent's `Cargo.lock` is no longer zero-third-party. The dependency graph becomes
  cargo-deny-gated and SBOM-tracked, with a CI job asserting source, license, and advisory status
  across the tree.
- Offline integrity verification becomes a testable property in the agent: a signed export verifies
  from its embedded public key, and a tampered payload, an unsupported schema version, or an
  unsupported algorithm each fail with a distinct, typed error (MAT-97 R-04 / R-05 / R-08).
  Authenticity is a separate trust decision on the key (see Decision), not something the embedded key
  settles on its own.
- The exact pin makes any future major bump (3.x) an explicit, reviewed change after soak, not an
  automatic upgrade.
- The agent binary grows by the curve implementation — acceptable for an agent binary, not a
  constrained target.
- A committed, clearly labelled non-production test keypair lives under the agent's `tests/` for
  reproducible golden artifacts. No production private key ever enters the repository.

## Rejected alternatives

- **Hand-roll Ed25519 in `std`** (as MAT-93 did for SHA-256): rejected — asymmetric-curve code is a
  critical-vulnerability magnet, and the SHA-256 precedent does not carry over to signature crypto.
- **Put signing in `sovri-sdk-rust`**: rejected — it would break the SDK's zero-dependency contract
  and push a crypto dependency onto every SDK consumer. Signing is an agent-side export concern.
- **Adopt `ed25519-dalek` 3.0.0 now**: rejected for this milestone — released 2026-07-06 with no
  soak; the mature 2.2.x line meets the need and respects the minimum-delay rule. Revisit later.
- **A heavier crypto stack (ring, openssl)**: rejected — larger surface and a C/asm or system-OpenSSL
  build cost for a single primitive, against the single-portable-binary, air-gap posture (ADR-023).
- **Symmetric MAC (HMAC)**: rejected — a shared secret cannot support third-party offline
  verification, the same reason ADR-014 rejected it.
- **Treat the embedded public key as proof of authenticity**: rejected — a self-embedded key only
  proves the payload is internally consistent with it, not that Sovri signed it. Authenticity needs an
  out-of-band trusted key or key id (ADR-014's expected-key input); the embedded key covers
  integrity / tamper-evidence only.
