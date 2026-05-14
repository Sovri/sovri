// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

// Scaffold barrel — the `createLogger` factory described in ARCHI.md §4.5
// lands in a follow-up task. The package re-exports Pino's `Logger` type so
// consumers can already wire the future return type at compile time without
// pulling in a runtime symbol.
export type { Logger } from "pino";
