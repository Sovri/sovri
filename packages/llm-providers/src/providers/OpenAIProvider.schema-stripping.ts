// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri SAS

import { z } from "@sovri/core";

import { zodToProviderJsonSchema } from "../helpers/provider-json-schema.js";

export function stripOpenAIOptionalNulls(value: unknown, schema: z.ZodType): unknown {
  return stripOptionalNullsFromValue(value, zodToProviderJsonSchema(schema));
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
    if (
      propertyValue === null &&
      !requiredProperties.has(propertyName) &&
      !allowsNullJsonSchemaValue(propertySchema)
    ) {
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
    if (!matchesJsonSchemaValue(candidate, schema)) {
      continue;
    }

    const removedNulls = sourceNulls - countNullValues(candidate);
    if (removedNulls > bestRemovedNulls) {
      bestValue = candidate;
      bestRemovedNulls = removedNulls;
    }
  }

  return bestValue;
}

function matchesJsonSchemaValue(value: unknown, schema: unknown): boolean {
  if (!isJsonObject(schema)) {
    return true;
  }

  return (
    matchesJsonSchemaAlternatives(value, schema) &&
    matchesJsonSchemaConstOrEnum(value, schema) &&
    matchesJsonSchemaType(value, schema["type"]) &&
    matchesJsonSchemaChildren(value, schema)
  );
}

function matchesJsonSchemaAlternatives(value: unknown, schema: Record<string, unknown>): boolean {
  const anyOf = schema["anyOf"];
  if (Array.isArray(anyOf) && !anyOf.some((branch) => matchesJsonSchemaValue(value, branch))) {
    return false;
  }

  const oneOf = schema["oneOf"];
  return !Array.isArray(oneOf) || oneOf.some((branch) => matchesJsonSchemaValue(value, branch));
}

function matchesJsonSchemaConstOrEnum(value: unknown, schema: Record<string, unknown>): boolean {
  if (Object.hasOwn(schema, "const") && !Object.is(value, schema["const"])) {
    return false;
  }

  const values = schema["enum"];
  return !Array.isArray(values) || values.some((item) => Object.is(item, value));
}

function matchesJsonSchemaType(value: unknown, type: unknown): boolean {
  return typeof type === "string"
    ? matchesJsonSchemaSingleType(value, type)
    : !isStringArray(type) || type.some((item) => matchesJsonSchemaSingleType(value, item));
}

function matchesJsonSchemaSingleType(value: unknown, type: string): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return isJsonObject(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number";
    default:
      return typeof value === type;
  }
}

function matchesJsonSchemaChildren(value: unknown, schema: Record<string, unknown>): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => matchesJsonSchemaValue(item, schema["items"]));
  }
  if (!isJsonObject(value)) {
    return true;
  }

  return matchesJsonSchemaObjectChildren(value, schema);
}

function matchesJsonSchemaObjectChildren(
  value: Record<string, unknown>,
  schema: Record<string, unknown>,
): boolean {
  const properties = schema["properties"];
  const requiredProperties = stringArray(schema["required"]);
  if (requiredProperties.some((propertyName) => value[propertyName] === undefined)) {
    return false;
  }
  if (!isJsonObject(properties)) {
    return true;
  }

  return Object.entries(value).every(([propertyName, propertyValue]) =>
    matchesJsonSchemaValue(propertyValue, properties[propertyName]),
  );
}

function countNullValues(value: unknown): number {
  if (value === null) {
    return 1;
  }
  if (!Array.isArray(value) && !isJsonObject(value)) {
    return 0;
  }

  const values = Array.isArray(value) ? value : Object.values(value);
  let count = 0;
  for (const item of values) {
    count += countNullValues(item);
  }

  return count;
}

function allowsNullJsonSchemaValue(value: unknown): boolean {
  if (!isJsonObject(value)) {
    return false;
  }

  const type = value["type"];
  if (type === "null") {
    return true;
  }
  if (isStringArray(type) && type.includes("null")) {
    return true;
  }

  const anyOf = value["anyOf"];
  return Array.isArray(anyOf) && anyOf.some(allowsNullJsonSchemaValue);
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
