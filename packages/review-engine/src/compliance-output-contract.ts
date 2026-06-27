// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Sovri contributors

import { z } from "zod";

const RequiredStringSchema = z.string().trim().min(1);
const SourceUrlSchema = z.string().trim().url();

const RequiredFields = [
  { property: "framework_id", label: "framework id" },
  { property: "control_id", label: "control id" },
  { property: "source_url", label: "source URL" },
  { property: "evidence", label: "evidence" },
  { property: "status", label: "status" },
  { property: "severity", label: "severity" },
  { property: "remediation_guidance", label: "remediation guidance" },
] as const;

const ComplianceGapInputSchema = z.object({
  id: RequiredStringSchema.optional(),
  framework_id: RequiredStringSchema,
  control_id: RequiredStringSchema,
  source_url: SourceUrlSchema,
  evidence: RequiredStringSchema,
  status: z.enum(["WARNING", "FAIL"]),
  severity: z.enum(["blocker", "major", "minor", "info", "nitpick"]),
  remediation_guidance: RequiredStringSchema,
});

export const ComplianceGapOutputSchema = z.strictObject({
  type: z.literal("ComplianceGap"),
  framework_id: RequiredStringSchema,
  control_id: RequiredStringSchema,
  source_url: SourceUrlSchema,
  evidence: RequiredStringSchema,
  status: z.enum(["WARNING", "FAIL"]),
  severity: z.enum(["blocker", "major", "minor", "info", "nitpick"]),
  remediation_guidance: RequiredStringSchema,
});

export type ComplianceGapOutput = z.infer<typeof ComplianceGapOutputSchema>;

export type ComplianceGapOutputValidation =
  | {
      readonly publishable: true;
      readonly serialized: ComplianceGapOutput;
    }
  | {
      readonly publishable: false;
      readonly missing_field: string;
    };

export class ComplianceGapOutputValidationError extends Error {
  constructor(public readonly validation: ComplianceGapOutputValidation) {
    super("Compliance gap output is not publishable");
    this.name = "ComplianceGapOutputValidationError";
  }
}

export function validateComplianceGapOutput(input: unknown): ComplianceGapOutputValidation {
  const missingField = findMissingRequiredField(input);

  if (missingField !== undefined) {
    return { publishable: false, missing_field: missingField };
  }

  const parsed = ComplianceGapInputSchema.safeParse(input);

  if (!parsed.success) {
    return { publishable: false, missing_field: findSchemaFieldLabel(parsed.error.issues) };
  }

  return { publishable: true, serialized: buildOutput(parsed.data) };
}

export function serializeComplianceGapOutput(input: unknown): ComplianceGapOutput {
  const validation = validateComplianceGapOutput(input);

  if (!validation.publishable) {
    throw new ComplianceGapOutputValidationError(validation);
  }

  return validation.serialized;
}

function buildOutput(input: z.infer<typeof ComplianceGapInputSchema>): ComplianceGapOutput {
  return ComplianceGapOutputSchema.parse({
    type: "ComplianceGap",
    framework_id: input.framework_id,
    control_id: input.control_id,
    source_url: input.source_url,
    evidence: input.evidence,
    status: input.status,
    severity: input.severity,
    remediation_guidance: input.remediation_guidance,
  });
}

function findMissingRequiredField(input: unknown): string | undefined {
  if (!isRecord(input)) {
    return "framework id";
  }

  for (const field of RequiredFields) {
    const value = input[field.property];

    if (typeof value !== "string" || value.trim().length === 0) {
      return field.label;
    }
  }

  return undefined;
}

function findSchemaFieldLabel(issues: readonly z.core.$ZodIssue[]): string {
  const firstPathItem = issues[0]?.path[0];

  if (typeof firstPathItem !== "string") {
    return "framework id";
  }

  return RequiredFields.find((field) => field.property === firstPathItem)?.label ?? "framework id";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
