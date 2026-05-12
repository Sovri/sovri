# ADR-009 — Multi-stage Docker + GitHub Container Registry

**Status:** Accepted
**Date:** 2026-05-12

## Context

Sovri Community is distributed as a Docker image for self-hosting. Choice of packaging format, base image, and registry.

Critical criteria for the regulated EU Enterprise target:

- Minimal attack surface (CVE)
- Non-root image (security)
- Reproducibility (lockfile included)
- EU hosting (sovereignty)

Alternatives evaluated: multi-stage Docker, distroless, packaged Bun runtime, npm archive.

## Decision

**Multi-stage Docker image based on `node:24-alpine`, published to GitHub Container Registry (GHCR).**

Tags following SemVer (`vX.Y.Z`, `vX.Y`, `vX`, `latest`, `sha-<commit>`).

Non-root user (`USER sovri`).

Built-in healthcheck on `/health`.

## Rationale

### Why Docker

- Standard format accepted by 100% of Enterprise clients.
- Readable: a Dockerfile is auditable in 5 minutes.
- Allows running on Kubernetes, Docker Compose, Podman, ECS, Cloud Run, etc.
- Works everywhere, identically everywhere.

### Why Alpine

- Final image ~150 MB, acceptable.
- Drastically reduces CVE surface compared to Debian/Ubuntu (musl libc, no superfluous packages).
- Active maintenance, regular releases.

### Why multi-stage

- **Stage 1 (builder)**: installs all dev dependencies + builds the project.
- **Stage 2 (prod-deps)**: installs only production dependencies.
- **Stage 3 (runtime)**: copies the builder's `dist/` + prod-deps' `node_modules`. No build toolchain in the final image, no devDependencies, no `.ts` sources.

Result: minimal image, reduced CVE surface, fast startup.

### Why GHCR

- **Free for OSS** (Community is Apache 2.0).
- **Native integration with GitHub Actions**: no external credential management.
- **Hosted US by GitHub/Microsoft**: acceptable for Community (image distribution, not client code).
- For Enterprise clients requiring an EU mirror, a republication mechanism on OVHcloud Container Registry will be set up in v1.0.

## Consequences

- No risk of leaking build credentials into the final image.
- Fast startup (~1s in cold start).
- Clear documentation for clients: `docker pull ghcr.io/sovri/community-bot:latest` then `docker run`.
- In v0.5+, image signing via Sigstore/cosign.
- In v1.0, optional EU mirror on OVHcloud for clients who contractually require it.

## Published tags

- `latest` — latest stable release.
- `vX.Y.Z` — SemVer version.
- `vX.Y` — most recent minor alias (e.g., `v0.5`).
- `vX` — most recent major alias (e.g., `v0`).
- `sha-<commit>` — for debugging, traceability.

## Rejected alternatives

- **Distroless**: even smaller CVE surface but debugging is much more painful (no shell). To reconsider in v1.0+ when the image is stable.
- **Packaged Bun runtime**: compilable to single binary but requires Bun (see ADR-001 on the rejection of Bun in v0.1).
- **npm archive**: would require the client to install Node and configure everything, friction too high for Enterprise.
- **Debian/Ubuntu base image**: 200-300 MB more, significantly larger CVE surface, not justifiable.
- **Docker Hub**: possible but GHCR is better integrated with GitHub Actions and simpler for OSS.
