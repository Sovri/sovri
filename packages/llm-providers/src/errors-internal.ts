// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

/**
 * Build the `ErrorOptions` bag for a typed error, omitting `cause` entirely
 * when it is undefined. Shared by the package error classes and the per-provider
 * error modules; intentionally not re-exported from the package barrel.
 */
export function errorOptions(cause: unknown): ErrorOptions | undefined {
  return cause === undefined ? undefined : { cause };
}
