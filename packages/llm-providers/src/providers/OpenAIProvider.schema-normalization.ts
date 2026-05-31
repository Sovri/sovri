// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "@sovri/core";

import { zodToProviderJsonSchema } from "../helpers/provider-json-schema.js";
import { OpenAIProviderError } from "./OpenAIProvider.errors.js";

export function createOpenAIStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  try {
    const jsonSchema = zodToProviderJsonSchema(schema);

    if (!isJsonObject(jsonSchema) || jsonSchema["type"] !== "object") {
      throw new OpenAIProviderError("OpenAI JSON schema root must be an object schema");
    }

    return normalizeOpenAIStrictJsonSchema(jsonSchema);
  } catch (cause) {
    if (cause instanceof OpenAIProviderError) throw cause;

    throw new OpenAIProviderError("Failed to build OpenAI response schema", { cause });
  }
}

export function stripOpenAIOptionalNulls(value: unknown, schema: z.ZodType): unknown {
  return stripOptionalNullsFromValue(value, zodToProviderJsonSchema(schema));
}

function normalizeOpenAIStrictJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeJsonSchemaValue(schema);
  if (!isJsonObject(normalized)) {
    throw new OpenAIProviderError("OpenAI JSON schema root must be an object schema");
  }

  return normalized;
}

function normalizeJsonSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonSchemaValue);
  }
  if (!isJsonObject(value)) {
    return value;
  }

  const normalized = normalizeJsonSchemaObject(value);
  normalizeOpenAIObjectShape(normalized);

  return normalized;
}

function normalizeJsonSchemaObject(value: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    normalized[key] = normalizeJsonSchemaValue(child);
  }

  return normalized;
}

function normalizeOpenAIObjectShape(schema: Record<string, unknown>): void {
  const properties = schema["properties"];
  if (schema["type"] !== "object" && !isJsonObject(properties)) {
    return;
  }
  if (hasDynamicObjectProperties(schema)) {
    throw new OpenAIProviderError(
      "OpenAI strict JSON schemas do not support dynamic object properties",
    );
  }

  const requiredProperties = new Set(stringArray(schema["required"]));
  if (isJsonObject(properties)) {
    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      if (!requiredProperties.has(propertyName)) {
        properties[propertyName] = allowNullJsonSchemaValue(propertySchema);
      }
    }
  }

  schema["additionalProperties"] = false;
  schema["required"] = isJsonObject(properties) ? Object.keys(properties) : [];
}

function allowNullJsonSchemaValue(value: unknown): unknown {
  if (!isJsonObject(value)) {
    return value;
  }

  const type = value["type"];
  if (typeof type === "string") {
    value["type"] = type === "null" ? type : [type, "null"];
    return value;
  }
  if (isStringArray(type)) {
    value["type"] = type.includes("null") ? type : [...type, "null"];
    return value;
  }

  const anyOf = value["anyOf"];
  if (Array.isArray(anyOf) && !anyOf.some(isNullSchema)) {
    value["anyOf"] = [...anyOf, { type: "null" }];
  }

  return value;
}

function stripOptionalNullsFromValue(value: unknown, schema: unknown): unknown {
  if (Array.isArray(value)) {
    const itemSchema = isJsonObject(schema) ? schema["items"] : undefined;
    return value.map((item) => stripOptionalNullsFromValue(item, itemSchema));
  }
  if (!isJsonObject(value) || !isJsonObject(schema)) {
    return value;
  }

  const anyOf = schema["anyOf"];
  if (Array.isArray(anyOf)) {
    return stripOptionalNullsFromAnyOf(value, anyOf);
  }

  const properties = schema["properties"];
  if (!isJsonObject(properties)) {
    return value;
  }

  const requiredProperties = new Set(stringArray(schema["required"]));
  const normalized: Record<string, unknown> = {};
  for (const [propertyName, propertyValue] of Object.entries(value)) {
    const propertySchema = properties[propertyName];
    if (propertyValue === null && !requiredProperties.has(propertyName)) {
      continue;
    }

    normalized[propertyName] = stripOptionalNullsFromValue(propertyValue, propertySchema);
  }

  return normalized;
}

function stripOptionalNullsFromAnyOf(value: unknown, schemas: ReadonlyArray<unknown>): unknown {
  let bestValue = value;
  let bestRemovedNulls = -1;
  const sourceNulls = countNullValues(value);

  for (const schema of schemas) {
    const candidate = stripOptionalNullsFromValue(value, schema);
    const removedNulls = sourceNulls - countNullValues(candidate);
    if (removedNulls > bestRemovedNulls) {
      bestValue = candidate;
      bestRemovedNulls = removedNulls;
    }
  }

  return bestValue;
}

function countNullValues(value: unknown): number {
  if (value === null) {
    return 1;
  }
  let count = 0;
  if (Array.isArray(value)) {
    for (const item of value) {
      count += countNullValues(item);
    }

    return count;
  }
  if (!isJsonObject(value)) {
    return 0;
  }

  for (const item of Object.values(value)) {
    count += countNullValues(item);
  }

  return count;
}

function hasDynamicObjectProperties(schema: Record<string, unknown>): boolean {
  const additionalProperties = schema["additionalProperties"];
  return (
    schema["propertyNames"] !== undefined ||
    (additionalProperties !== undefined && additionalProperties !== false)
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function stringArray(value: unknown): readonly string[] {
  return isStringArray(value) ? value : [];
}

function isNullSchema(value: unknown): boolean {
  return isJsonObject(value) && value["type"] === "null";
}
