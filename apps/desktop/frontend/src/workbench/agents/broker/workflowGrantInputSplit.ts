export type WorkflowGrantScope = {
  capabilityIds?: readonly string[];
  evidenceBundleIds?: readonly string[];
  executorWidgetIds?: readonly string[];
  messageIds?: readonly string[];
  moduleIds?: readonly string[];
  runIds?: readonly string[];
  taskIds?: readonly string[];
};

export type WorkflowGrant = {
  confirmationToken?: string;
  constraints?: Record<string, unknown>;
  maxActions?: number;
  mode?: string;
  scope?: WorkflowGrantScope;
};

export type WorkflowInputs = Record<string, unknown>;

export type WorkflowGrantInputSplitReasonCode =
  | "invalid_grant_field"
  | "invalid_grant_scope"
  | "malformed_grant"
  | "malformed_inputs"
  | "product_input_in_grant";

export type WorkflowGrantInputSplitIssue = {
  fieldPath: string;
  message: string;
  reasonCode: WorkflowGrantInputSplitReasonCode;
};

export type WorkflowGrantInputSplitValidationResult =
  | {
      grant?: WorkflowGrant;
      inputs?: WorkflowInputs;
      issues: [];
      valid: true;
    }
  | {
      fieldPath: string;
      issues: WorkflowGrantInputSplitIssue[];
      message: string;
      reasonCode: WorkflowGrantInputSplitReasonCode;
      valid: false;
    };

const GRANT_FIELDS = new Set([
  "confirmationToken",
  "constraints",
  "maxActions",
  "mode",
  "scope",
]);

const PRODUCT_INPUT_FIELDS = new Set([
  "approvalPolicy",
  "codexExecutable",
  "dependsOn",
  "dependsOnSlots",
  "evidenceBundleId",
  "executorWidgetId",
  "inputs",
  "messageId",
  "prompt",
  "prompts",
  "runId",
  "runSettings",
  "sandbox",
  "task",
  "taskId",
  "tasks",
  "title",
  "workflowInputs",
  "workspaceRoot",
]);

const SCOPE_ID_FIELDS = new Set([
  "capabilityIds",
  "evidenceBundleIds",
  "executorWidgetIds",
  "messageIds",
  "moduleIds",
  "runIds",
  "taskIds",
]);

const SCOPE_FIELD_FOR_SINGULAR_ID: Record<string, string> = {
  evidenceBundleId: "evidenceBundleIds",
  executorWidgetId: "executorWidgetIds",
  messageId: "messageIds",
  runId: "runIds",
  taskId: "taskIds",
};

export function validateWorkflowGrantAndInputsSplit(
  envelope: Record<string, unknown>,
): WorkflowGrantInputSplitValidationResult {
  const issues: WorkflowGrantInputSplitIssue[] = [];
  const hasGrant = Object.prototype.hasOwnProperty.call(envelope, "grant");
  const hasInputs = Object.prototype.hasOwnProperty.call(envelope, "inputs");

  if (hasGrant) {
    validateGrant(envelope.grant, issues);
  }

  if (hasInputs) {
    validateInputs(envelope.inputs, issues);
  }

  if (issues.length > 0) {
    const firstIssue = issues[0] ?? {
      fieldPath: "$",
      message: "Workflow grant/input split is invalid.",
      reasonCode: "invalid_grant_field" as const,
    };
    return {
      fieldPath: firstIssue.fieldPath,
      issues,
      message: firstIssue.message,
      reasonCode: firstIssue.reasonCode,
      valid: false,
    };
  }

  return {
    ...(hasGrant ? { grant: envelope.grant as WorkflowGrant } : {}),
    ...(hasInputs ? { inputs: envelope.inputs as WorkflowInputs } : {}),
    issues: [],
    valid: true,
  };
}

function validateGrant(
  value: unknown,
  issues: WorkflowGrantInputSplitIssue[],
) {
  if (!isRecord(value)) {
    issues.push({
      fieldPath: "$.grant",
      message: "Workflow grant must be a JSON object.",
      reasonCode: "malformed_grant",
    });
    return;
  }

  collectProductInputFieldsInGrant(value, "$.grant", issues);

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    if (PRODUCT_INPUT_FIELDS.has(fieldName)) {
      continue;
    }
    if (SCOPE_ID_FIELDS.has(fieldName)) {
      issues.push({
        fieldPath: `$.grant.${fieldName}`,
        message: `Scope ids belong under $.grant.scope.${fieldName}.`,
        reasonCode: "invalid_grant_scope",
      });
      continue;
    }
    if (!GRANT_FIELDS.has(fieldName)) {
      issues.push({
        fieldPath: `$.grant.${fieldName}`,
        message: `Workflow grant field ${fieldName} is not supported. Grants may contain only permission and scope metadata.`,
        reasonCode: "invalid_grant_field",
      });
      continue;
    }

    validateGrantField(fieldName, fieldValue, issues);
  }
}

function validateGrantField(
  fieldName: string,
  value: unknown,
  issues: WorkflowGrantInputSplitIssue[],
) {
  switch (fieldName) {
    case "confirmationToken":
    case "mode":
      if (typeof value !== "string" || !value.trim()) {
        issues.push({
          fieldPath: `$.grant.${fieldName}`,
          message: `Workflow grant ${fieldName} must be a non-empty string.`,
          reasonCode: "invalid_grant_field",
        });
      }
      return;
    case "maxActions":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value <= 0
      ) {
        issues.push({
          fieldPath: "$.grant.maxActions",
          message: "Workflow grant maxActions must be a positive integer.",
          reasonCode: "invalid_grant_field",
        });
      }
      return;
    case "constraints":
      if (!isRecord(value)) {
        issues.push({
          fieldPath: "$.grant.constraints",
          message: "Workflow grant constraints must be a JSON object.",
          reasonCode: "invalid_grant_field",
        });
      }
      return;
    case "scope":
      validateGrantScope(value, issues);
      return;
  }
}

function validateGrantScope(
  value: unknown,
  issues: WorkflowGrantInputSplitIssue[],
) {
  if (!isRecord(value)) {
    issues.push({
      fieldPath: "$.grant.scope",
      message: "Workflow grant scope must be a JSON object.",
      reasonCode: "invalid_grant_scope",
    });
    return;
  }

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    if (!SCOPE_ID_FIELDS.has(fieldName)) {
      issues.push({
        fieldPath: `$.grant.scope.${fieldName}`,
        message: scopeFieldMessage(fieldName),
        reasonCode: "invalid_grant_scope",
      });
      continue;
    }

    if (!stringArray(fieldValue)) {
      issues.push({
        fieldPath: `$.grant.scope.${fieldName}`,
        message: `Workflow grant scope ${fieldName} must be an array of non-empty strings.`,
        reasonCode: "invalid_grant_scope",
      });
    }
  }
}

function validateInputs(
  value: unknown,
  issues: WorkflowGrantInputSplitIssue[],
) {
  if (!isRecord(value)) {
    issues.push({
      fieldPath: "$.inputs",
      message: "Workflow inputs must be a JSON object.",
      reasonCode: "malformed_inputs",
    });
  }
}

function collectProductInputFieldsInGrant(
  value: unknown,
  fieldPath: string,
  issues: WorkflowGrantInputSplitIssue[],
) {
  if (fieldPath === "$.grant.scope") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectProductInputFieldsInGrant(item, `${fieldPath}[${index}]`, issues),
    );
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    const childPath = `${fieldPath}.${fieldName}`;

    if (PRODUCT_INPUT_FIELDS.has(fieldName)) {
      issues.push({
        fieldPath: childPath,
        message: productInputMessage(fieldName),
        reasonCode: "product_input_in_grant",
      });
      continue;
    }

    if (
      SCOPE_ID_FIELDS.has(fieldName) &&
      fieldPath !== "$.grant" &&
      fieldPath !== "$.grant.scope"
    ) {
      issues.push({
        fieldPath: childPath,
        message: `Scope ids belong under $.grant.scope.${fieldName}.`,
        reasonCode: "invalid_grant_scope",
      });
      continue;
    }

    collectProductInputFieldsInGrant(fieldValue, childPath, issues);
  }
}

function productInputMessage(fieldName: string) {
  const scopeField = SCOPE_FIELD_FOR_SINGULAR_ID[fieldName];
  if (scopeField) {
    return `Workflow grant cannot contain direct ${fieldName}. Use $.grant.scope.${scopeField} for permission scope, or put workflow data under $.inputs.`;
  }

  return `Workflow grant cannot contain workflow data field ${fieldName}. Put workflow data under $.inputs.`;
}

function scopeFieldMessage(fieldName: string) {
  const scopeField = SCOPE_FIELD_FOR_SINGULAR_ID[fieldName];
  if (scopeField) {
    return `Workflow grant scope uses ${scopeField}, not ${fieldName}.`;
  }

  return `Workflow grant scope field ${fieldName} is not supported. Scope ids must use explicit *Ids arrays.`;
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && Boolean(item.trim()))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
