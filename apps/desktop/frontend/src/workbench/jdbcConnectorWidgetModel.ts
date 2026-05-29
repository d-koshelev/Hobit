import type {
  JdbcConnectorStatus,
  JdbcDatabaseKind,
  JdbcDriverKind,
} from "../workspace/jdbcConnectorTypes";

export type JdbcConnectionProfileDraft = {
  profileId?: string;
  displayName: string;
  databaseKind: JdbcDatabaseKind;
  driverKind: JdbcDriverKind;
  jdbcUrlMetadata: string;
  username?: string | null;
  defaultDatabase?: string | null;
  defaultSchema?: string | null;
  defaultCatalog?: string | null;
  readOnly: boolean;
  rowLimit: number;
  queryTimeoutMs: number;
  description?: string | null;
  tags?: string[];
};

export type JdbcSecretReference = {
  kind: "runtime_prompt" | "future_os_secret_store";
  label: string;
  secretValue?: never;
};

export type JdbcReadOnlyExecutionPolicy = {
  readOnlyOnly: true;
  requiresExplicitUserRun: true;
  allowMultiStatement: false;
  allowStoredProcedureExecution: false;
  rowLimit: number;
  queryTimeoutMs: number;
};

export type JdbcExperimentalRuntimeDraft = {
  enabled: boolean;
  javaProgram: string;
  sidecarJarPath: string;
  sidecarClasspath: string;
  sidecarMainClass: string;
  driverJarPath: string;
  driverClassName: string;
  jdbcUrl: string;
  username: string;
  credentialEnvVarName: string;
  maxRows: number;
  timeoutMs: number;
  maxResultBytes: number;
};

export type JdbcBoundaryFilterType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "timestamp"
  | "stringList"
  | "integerList";

export type JdbcBoundaryFilterDefinition = {
  key: string;
  label: string;
  type: JdbcBoundaryFilterType;
  required: boolean;
  description?: string;
};

export type JdbcBoundaryRangeSource =
  | { kind: "literal"; value: number }
  | { kind: "filter"; filterKey: string };

export type JdbcBoundaryRangeDefinition = {
  variable: "value";
  min: number;
  max: number;
  minSource?: JdbcBoundaryRangeSource;
  maxSource?: JdbcBoundaryRangeSource;
  precision: number;
};

export type JdbcBoundaryExecutionPolicy = {
  maxProbes: number;
  maxIterations: number;
  timeoutMs: number;
};

export type JdbcBoundaryBooleanResultExtraction = {
  kind: "firstRowColumn";
  column: string;
  trueValues?: string[];
  falseValues?: string[];
};

export type JdbcBoundaryPreset = {
  presetId: string;
  name: string;
  sqlTemplate: string;
  filters: JdbcBoundaryFilterDefinition[];
  range: JdbcBoundaryRangeDefinition;
  booleanResult: JdbcBoundaryBooleanResultExtraction;
  executionPolicy: JdbcBoundaryExecutionPolicy;
};

export type JdbcBoundaryProbe = {
  index: number;
  value: number;
  result: boolean;
};

export type JdbcBoundaryResult = {
  status:
    | "boundary_found"
    | "no_boundary"
    | "probe_cap_reached"
    | "iteration_cap_reached";
  direction: "false_to_true" | "true_to_false" | null;
  lowerValue: number | null;
  lowerResult: boolean | null;
  upperValue: number | null;
  upperResult: boolean | null;
  iterations: number;
  probes: JdbcBoundaryProbe[];
};

export type JdbcBoundaryFilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | undefined;

export type JdbcBoundaryFilterValues = Record<string, JdbcBoundaryFilterValue>;

export type JdbcBoundaryValidationResult = {
  isValid: boolean;
  errors: string[];
};

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
const FILTER_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_BOUNDARY_PROBES = 1000;
const MAX_BOUNDARY_ITERATIONS = 1000;
const MAX_BOUNDARY_TIMEOUT_MS = 300000;

export function validateJdbcBoundaryPreset(
  preset: JdbcBoundaryPreset,
): JdbcBoundaryValidationResult {
  const errors: string[] = [];
  const filterKeys = new Set<string>();

  if (hasForbiddenSecretField(preset)) {
    errors.push(
      "Boundary preset JSON must not contain password, token, secret, or secretValue fields.",
    );
  }

  const placeholders = extractPlaceholders(preset.sqlTemplate);

  if (!placeholders.includes("value")) {
    errors.push("Boundary SQL template must contain the reserved {{value}} placeholder.");
  }

  for (const filter of preset.filters) {
    if (!FILTER_KEY_PATTERN.test(filter.key)) {
      errors.push(`Boundary filter key is invalid: ${filter.key}.`);
      continue;
    }
    if (filter.key === "value") {
      errors.push("Boundary filter key value is reserved for range probes.");
    }
    if (filterKeys.has(filter.key)) {
      errors.push(`Boundary filter key is duplicated: ${filter.key}.`);
    }
    filterKeys.add(filter.key);
  }

  for (const placeholder of placeholders) {
    if (placeholder !== "value" && !filterKeys.has(placeholder)) {
      errors.push(`Boundary SQL template contains unknown placeholder: ${placeholder}.`);
    }
  }

  if (preset.range.variable !== "value") {
    errors.push("Boundary range variable must be value.");
  }
  if (!Number.isFinite(preset.range.min) || !Number.isFinite(preset.range.max)) {
    errors.push("Boundary range min and max must be finite numbers.");
  } else if (preset.range.min >= preset.range.max) {
    errors.push("Boundary range min must be less than max.");
  }
  if (!Number.isFinite(preset.range.precision) || preset.range.precision <= 0) {
    errors.push("Boundary range precision must be a positive number.");
  } else if (
    Number.isFinite(preset.range.min) &&
    Number.isFinite(preset.range.max) &&
    preset.range.precision > preset.range.max - preset.range.min
  ) {
    errors.push("Boundary range precision must not exceed the search range.");
  }

  validateRangeSource("minSource", preset.range.minSource, filterKeys, errors);
  validateRangeSource("maxSource", preset.range.maxSource, filterKeys, errors);
  validateBoundaryExecutionPolicy(preset.executionPolicy, errors);

  if (preset.booleanResult.kind !== "firstRowColumn") {
    errors.push("Boundary boolean result extraction kind is unsupported.");
  }
  if (!preset.booleanResult.column.trim()) {
    errors.push("Boundary boolean result extraction column is required.");
  }

  return { errors, isValid: errors.length === 0 };
}

export function renderJdbcBoundarySql(
  preset: JdbcBoundaryPreset,
  values: JdbcBoundaryFilterValues,
  probeValue: number,
): string {
  const validation = validateJdbcBoundaryPreset(preset);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }
  if (!Number.isFinite(probeValue)) {
    throw new Error("Boundary probe value must be a finite number.");
  }

  const filtersByKey = new Map(
    preset.filters.map((filter) => [filter.key, filter] as const),
  );

  for (const filter of preset.filters) {
    const value = values[filter.key];

    if (filter.required && isMissingBoundaryValue(value)) {
      throw new Error(`Missing required boundary filter value: ${filter.key}.`);
    }
  }

  return preset.sqlTemplate.replace(
    PLACEHOLDER_PATTERN,
    (_match, key: string) => {
      if (key === "value") {
        return renderBoundaryNumberLiteral(probeValue, "value", false);
      }

      const filter = filtersByKey.get(key);
      if (!filter) {
        throw new Error(`Unknown boundary SQL placeholder: ${key}.`);
      }

      const value = values[key];
      if (isMissingBoundaryValue(value)) {
        throw new Error(`Missing boundary filter value: ${key}.`);
      }

      return renderBoundaryFilterLiteral(filter, value);
    },
  );
}

export async function findJdbcBoundary(
  range: JdbcBoundaryRangeDefinition,
  executionPolicy: JdbcBoundaryExecutionPolicy,
  evaluator: (value: number) => Promise<boolean>,
): Promise<JdbcBoundaryResult> {
  const policyErrors: string[] = [];
  validateBoundaryExecutionPolicy(executionPolicy, policyErrors);

  if (policyErrors.length > 0) {
    throw new Error(policyErrors.join(" "));
  }
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    throw new Error("Boundary range min and max must be finite numbers.");
  }
  if (range.min >= range.max) {
    throw new Error("Boundary range min must be less than max.");
  }
  if (!Number.isFinite(range.precision) || range.precision <= 0) {
    throw new Error("Boundary range precision must be a positive number.");
  }

  const probes: JdbcBoundaryProbe[] = [];

  const evaluate = async (value: number) => {
    if (probes.length >= executionPolicy.maxProbes) {
      return null;
    }

    const result = await evaluator(value);
    const probe = {
      index: probes.length,
      result,
      value,
    };
    probes.push(probe);

    return probe;
  };

  const minProbe = await evaluate(range.min);
  const maxProbe = await evaluate(range.max);

  if (!minProbe || !maxProbe) {
    return boundaryLimitResult("probe_cap_reached", null, null, null, 0, probes);
  }

  if (minProbe.result === maxProbe.result) {
    return {
      direction: null,
      iterations: 0,
      lowerResult: minProbe.result,
      lowerValue: minProbe.value,
      probes,
      status: "no_boundary",
      upperResult: maxProbe.result,
      upperValue: maxProbe.value,
    };
  }

  const direction = minProbe.result ? "true_to_false" : "false_to_true";
  let lower = minProbe;
  let upper = maxProbe;
  let iterations = 0;

  while (upper.value - lower.value > range.precision) {
    if (iterations >= executionPolicy.maxIterations) {
      return boundaryLimitResult(
        "iteration_cap_reached",
        direction,
        lower,
        upper,
        iterations,
        probes,
      );
    }

    const midpoint = lower.value + (upper.value - lower.value) / 2;
    const probe = await evaluate(midpoint);

    if (!probe) {
      return boundaryLimitResult(
        "probe_cap_reached",
        direction,
        lower,
        upper,
        iterations,
        probes,
      );
    }

    iterations += 1;

    if (direction === "false_to_true") {
      if (probe.result) {
        upper = probe;
      } else {
        lower = probe;
      }
    } else if (probe.result) {
      lower = probe;
    } else {
      upper = probe;
    }
  }

  return {
    direction,
    iterations,
    lowerResult: lower.result,
    lowerValue: lower.value,
    probes,
    status: "boundary_found",
    upperResult: upper.result,
    upperValue: upper.value,
  };
}

export const DATABASE_KIND_OPTIONS: Array<{
  label: string;
  value: JdbcDatabaseKind;
}> = [
  { label: "Vertica", value: "vertica" },
  { label: "Postgres", value: "postgres" },
  { label: "Trino", value: "trino" },
  { label: "MySQL", value: "mysql" },
  { label: "Generic JDBC", value: "generic_jdbc" },
];

export const DRIVER_KIND_OPTIONS: Array<{
  label: string;
  value: JdbcDriverKind;
}> = [
  { label: "JDBC", value: "jdbc" },
  { label: "Generic JDBC", value: "generic_jdbc" },
];

export const STATUS_OPTIONS: Array<{
  label: string;
  value: JdbcConnectorStatus;
}> = [
  { label: "Not configured", value: "not_configured" },
  { label: "Metadata configured", value: "configured" },
  { label: "Disabled", value: "disabled" },
  { label: "Error", value: "error" },
];

export function statusLabel(status: JdbcConnectorStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function databaseKindLabel(kind: JdbcDatabaseKind) {
  return DATABASE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export function formatUpdatedTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

export function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function validateBoundaryExecutionPolicy(
  executionPolicy: JdbcBoundaryExecutionPolicy,
  errors: string[],
) {
  if (
    !Number.isInteger(executionPolicy.maxProbes) ||
    executionPolicy.maxProbes < 2 ||
    executionPolicy.maxProbes > MAX_BOUNDARY_PROBES
  ) {
    errors.push(
      `Boundary execution maxProbes must be an integer from 2 to ${MAX_BOUNDARY_PROBES}.`,
    );
  }

  if (
    !Number.isInteger(executionPolicy.maxIterations) ||
    executionPolicy.maxIterations < 1 ||
    executionPolicy.maxIterations > MAX_BOUNDARY_ITERATIONS
  ) {
    errors.push(
      `Boundary execution maxIterations must be an integer from 1 to ${MAX_BOUNDARY_ITERATIONS}.`,
    );
  }

  if (
    !Number.isInteger(executionPolicy.timeoutMs) ||
    executionPolicy.timeoutMs < 1 ||
    executionPolicy.timeoutMs > MAX_BOUNDARY_TIMEOUT_MS
  ) {
    errors.push(
      `Boundary execution timeoutMs must be an integer from 1 to ${MAX_BOUNDARY_TIMEOUT_MS}.`,
    );
  }
}

function validateRangeSource(
  label: string,
  source: JdbcBoundaryRangeSource | undefined,
  filterKeys: Set<string>,
  errors: string[],
) {
  if (!source) {
    return;
  }

  if (source.kind === "literal") {
    if (!Number.isFinite(source.value)) {
      errors.push(`Boundary range ${label} literal must be finite.`);
    }
    return;
  }

  if (source.kind === "filter") {
    if (!filterKeys.has(source.filterKey)) {
      errors.push(`Boundary range ${label} references unknown filter: ${source.filterKey}.`);
    }
    return;
  }

  errors.push(`Boundary range ${label} source is unsupported.`);
}

function extractPlaceholders(template: string) {
  const placeholders: string[] = [];

  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    placeholders.push(match[1]);
  }

  return placeholders;
}

function isMissingBoundaryValue(value: JdbcBoundaryFilterValue) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function renderBoundaryFilterLiteral(
  filter: JdbcBoundaryFilterDefinition,
  value: JdbcBoundaryFilterValue,
) {
  switch (filter.type) {
    case "string":
      return renderBoundaryStringLiteral(assertBoundaryString(value, filter.key));
    case "integer":
      return renderBoundaryNumberLiteral(value, filter.key, true);
    case "decimal":
      return renderBoundaryNumberLiteral(value, filter.key, false);
    case "boolean":
      return renderBoundaryBooleanLiteral(value, filter.key);
    case "date":
      return renderBoundaryStringLiteral(assertBoundaryDate(value, filter.key));
    case "timestamp":
      return renderBoundaryStringLiteral(assertBoundaryTimestamp(value, filter.key));
    case "stringList":
      return renderBoundaryStringList(value, filter.key);
    case "integerList":
      return renderBoundaryIntegerList(value, filter.key);
    default:
      throw new Error(`Unsupported boundary filter type: ${filter.type}.`);
  }
}

function assertBoundaryString(value: JdbcBoundaryFilterValue, key: string) {
  if (typeof value !== "string") {
    throw new Error(`Boundary filter ${key} must be a string.`);
  }

  if (looksLikeSqlFragment(value)) {
    throw new Error(`Boundary filter ${key} must be a scalar value, not a SQL fragment.`);
  }

  return value;
}

function assertBoundaryDate(value: JdbcBoundaryFilterValue, key: string) {
  const text = assertBoundaryString(value, key);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    throw new Error(`Boundary filter ${key} must be an ISO date.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Boundary filter ${key} must be a valid ISO date.`);
  }

  return text;
}

function assertBoundaryTimestamp(value: JdbcBoundaryFilterValue, key: string) {
  const text = assertBoundaryString(value, key);

  if (
    !/^\d{4}-\d{2}-\d{2}(?:T| )\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/.test(
      text,
    )
  ) {
    throw new Error(`Boundary filter ${key} must be an ISO timestamp.`);
  }

  if (Number.isNaN(Date.parse(text.replace(" ", "T")))) {
    throw new Error(`Boundary filter ${key} must be a valid ISO timestamp.`);
  }

  return text;
}

function renderBoundaryStringLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderBoundaryNumberLiteral(
  value: JdbcBoundaryFilterValue,
  key: string,
  requireInteger: boolean,
) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Boundary filter ${key} must be a finite number.`);
  }

  if (requireInteger && !Number.isInteger(numberValue)) {
    throw new Error(`Boundary filter ${key} must be an integer.`);
  }

  return String(numberValue);
}

function renderBoundaryBooleanLiteral(value: JdbcBoundaryFilterValue, key: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Boundary filter ${key} must be a boolean.`);
  }

  return value ? "TRUE" : "FALSE";
}

function renderBoundaryStringList(value: JdbcBoundaryFilterValue, key: string) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item): item is string => typeof item === "string")
  ) {
    throw new Error(`Boundary filter ${key} must be a non-empty string list.`);
  }

  return value
    .map((item) => renderBoundaryStringLiteral(assertBoundaryString(item, key)))
    .join(", ");
}

function renderBoundaryIntegerList(value: JdbcBoundaryFilterValue, key: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Boundary filter ${key} must be a non-empty integer list.`);
  }

  return value
    .map((item) => renderBoundaryNumberLiteral(item, key, true))
    .join(", ");
}

function looksLikeSqlFragment(value: string) {
  return /;|--|\/\*|\*\/|\{\{|\}\}/.test(value) ||
    /\b(select|insert|update|delete|drop|alter|create|truncate|merge|grant|revoke|call|execute|union|from|where|join)\b/i.test(
      value,
    ) ||
    /\b(?:or|and)\s+\d+\s*=\s*\d+\b/i.test(value);
}

function hasForbiddenSecretField(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret")
    ) {
      return true;
    }

    if (hasForbiddenSecretField(nestedValue)) {
      return true;
    }
  }

  return false;
}

function boundaryLimitResult(
  status: "probe_cap_reached" | "iteration_cap_reached",
  direction: "false_to_true" | "true_to_false" | null,
  lower: JdbcBoundaryProbe | null,
  upper: JdbcBoundaryProbe | null,
  iterations: number,
  probes: JdbcBoundaryProbe[],
): JdbcBoundaryResult {
  return {
    direction,
    iterations,
    lowerResult: lower?.result ?? null,
    lowerValue: lower?.value ?? null,
    probes,
    status,
    upperResult: upper?.result ?? null,
    upperValue: upper?.value ?? null,
  };
}
