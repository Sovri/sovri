// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { createHash, sign, type KeyObject } from "node:crypto";

import {
  SignedAuditTrailEntrySchema,
  type AuditTrailLogicalEvent,
  type SignedAuditTrailEntry,
} from "./schema.js";

/**
 * Build an Ed25519 audit-trail signer bound to one private key.
 *
 * The returned function turns a logical event plus its predecessor's hash into a signed,
 * chained entry. The signed content is the canonical JSON of the event together with its
 * `previous_hash` (only `entry_hash` and `signature` are excluded), so deletion or
 * reordering of entries breaks the chain and is detectable offline.
 *
 * Internal in v0.3 — not re-exported from the package entrypoint; the Cloud writer owns key
 * material and is the only caller. See ADR-014.
 */
export function createSigner(privateKey: KeyObject) {
  return (event: AuditTrailLogicalEvent, previousHash: string | null): SignedAuditTrailEntry => {
    const canonical = JSON.stringify({ ...event, previous_hash: previousHash });
    const entryHash = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
    const signature = `ed25519:${sign(null, Buffer.from(entryHash), privateKey).toString("base64url")}`;
    // Re-parse the assembled entry: it both yields the precise discriminated-union type
    // (TypeScript cannot narrow it through the spread) and enforces the chain invariant at
    // signing time — e.g. a `trail.started` entry must carry a null `previous_hash`.
    return SignedAuditTrailEntrySchema.parse({
      ...event,
      previous_hash: previousHash,
      entry_hash: entryHash,
      signature,
    });
  };
}
