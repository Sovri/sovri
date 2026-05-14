// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { pino } from "pino";
import type { Logger as PinoLogger } from "pino";

const VALID_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
type LogLevel = (typeof VALID_LEVELS)[number];

const PRETTY_TRUTHY = new Set(["true", "1", "yes", "on"]);

function isLogLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && (VALID_LEVELS as readonly string[]).includes(value);
}

// Treat empty-string env vars as unset. Common in docker-compose and Helm
// where an unset variable expands to "" rather than being absent.
function envOrDefault(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

const rawLevel = process.env.LOG_LEVEL?.toLowerCase();
const level: LogLevel = isLogLevel(rawLevel) ? rawLevel : "info";

const rawPretty = process.env.LOG_PRETTY?.toLowerCase() ?? "";
const env = envOrDefault(process.env.NODE_ENV, "development");
const isPretty = PRETTY_TRUTHY.has(rawPretty) && env !== "production";

// TODO(#23): wire pino-redact for secret paths before any handler emits webhook payloads.
const rootLogger = pino({
  level,
  base: {
    service: envOrDefault(process.env.SERVICE_NAME, "sovri-community-bot"),
    version: envOrDefault(process.env.SERVICE_VERSION, "0.0.0"),
    env,
  },
  ...(isPretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
});

export type Logger = PinoLogger;

export function createLogger(name: string): Logger {
  return rootLogger.child({ component: name });
}
