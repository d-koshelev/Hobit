import type {
  JdbcConnectorStatus,
  JdbcDatabaseKind,
  JdbcDriverKind,
} from "../workspace/jdbcConnectorTypes";

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
  { label: "Configured", value: "configured" },
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
