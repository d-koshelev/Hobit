export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "error";

export function formatUpdatedTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

export function queueSingleState({
  isLoading,
  loadError,
}: {
  isLoading: boolean;
  loadError: string | null;
}) {
  if (isLoading) {
    return {
      text: "Workspace queue tasks are loading.",
      title: "Loading queue.",
    };
  }

  if (loadError) {
    return {
      text: `${loadError} Use Refresh to try again.`,
      title: "Queue unavailable.",
    };
  }

  return null;
}

export function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatStatus(status: string) {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
