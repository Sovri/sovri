# ADR-030 — Framework catalog file layout

**Status:** Accepted
**Date:** 2026-06-30

## Context

ADR-024 makes the `sovri-frameworks` Git repository the source of truth for framework catalogs.
ADR-028 keeps official source metadata in catalog files, and ADR-029 requires rule execution to
consume versioned catalog data. MAT-83 turns those decisions into strict YAML schemas, so each
catalog file kind needs an explicit layout contract.

## Decision

Framework catalogs use versioned catalog directories containing `framework.yaml`, `control.yaml`,
`rule.yaml`, and `mapping.yaml`. The schema for each file rejects unknown fields, and catalog
review owns changes to these files before rule execution consumes them.

`framework.yaml` identifies the framework family, version, scope, and official source metadata.
`control.yaml` describes a control and its remediation contract. `rule.yaml` describes how evidence
is evaluated for a control. `mapping.yaml` links a control to one or more versioned framework
references.

## Consequences

- Catalog file changes remain reviewable as ordinary Git changes.
- The rule engine consumes a small, stable set of catalog file kinds.
- Framework references stay versioned and deduplicated before they reach rule execution.

## Rejected alternatives

- **Infer catalog layout from directory names:** hides schema meaning in repository conventions and
  makes rule execution depend on filesystem guesses.
- **Store all framework data in one YAML file:** makes review diffs noisy and couples independent
  control, rule, and mapping changes.
