#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function evaluateRuntime(options) {
  const expectedNodeVersion = normalizeVersion(options.expectedNodeVersion);
  const expectedPnpmVersion = readPackageManagerVersion(options.expectedPackageManager);
  const actualNodeVersion = normalizeVersion(options.actualNodeVersion);
  const actualPnpmVersion = normalizeVersion(options.actualPnpmVersion);
  const errors = [];

  if (actualNodeVersion !== expectedNodeVersion) {
    errors.push(
      `Node.js ${actualNodeVersion} does not match .nvmrc ${expectedNodeVersion}. Run: nvm use`,
    );
  }

  if (actualPnpmVersion !== expectedPnpmVersion) {
    errors.push(
      `pnpm ${actualPnpmVersion} does not match packageManager pnpm@${expectedPnpmVersion}. Run: corepack enable`,
    );
  }

  return errors.length === 0
    ? { nodeVersion: actualNodeVersion, ok: true, pnpmVersion: actualPnpmVersion }
    : { errors, ok: false };
}

export function readRuntimeInput() {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  return {
    actualNodeVersion: process.versions.node,
    actualPnpmVersion: execFileSync("pnpm", ["--version"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim(),
    expectedNodeVersion: readFileSync(resolve(repoRoot, ".nvmrc"), "utf8").trim(),
    expectedPackageManager: manifest.packageManager,
  };
}

export function run() {
  const result = evaluateRuntime(readRuntimeInput());
  if (!result.ok) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Runtime preflight passed (node ${result.nodeVersion}, pnpm ${result.pnpmVersion})\n`,
  );
}

function readPackageManagerVersion(packageManager) {
  if (typeof packageManager !== "string") {
    throw new Error("package.json packageManager must be a string");
  }
  const match = /^pnpm@(?<version>\d+\.\d+\.\d+)$/.exec(packageManager);
  if (match?.groups?.version === undefined) {
    throw new Error("package.json packageManager must pin pnpm with an exact version");
  }
  return match.groups.version;
}

function normalizeVersion(version) {
  return version.trim().replace(/^v/, "");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}
