import type { PromptPackDependencyPolicy } from "./promptPackModel";

export type UnknownRecord = Record<string, unknown>;

export const NUMBERED_PROMPT_PATTERN =
  /(?:^|\/)(?<order>\d{3}(?:\.\d{3})?)-(?<slug>[^/]+)\.(?:md|markdown)$/i;

export function promptPackMetadataSection(
  packId: string,
  itemId: string,
  metadata: {
    allowedScope: string[];
    dependencies: string[];
    expectedCommitTitle: string | null;
    forbiddenScope: string[];
    validationCommands: string[];
  },
) {
  const lines = [
    "",
    "",
    "Prompt pack metadata",
    `Pack id: ${packId}`,
    `Item id: ${itemId}`,
    metadata.dependencies.length > 0
      ? `Dependencies: ${metadata.dependencies.join(", ")}`
      : null,
    metadata.expectedCommitTitle
      ? `Expected commit title: ${metadata.expectedCommitTitle}`
      : null,
    ...sectionLines("Validation", metadata.validationCommands),
    ...sectionLines("Allowed scope", metadata.allowedScope),
    ...sectionLines("Forbidden scope", metadata.forbiddenScope),
    "Do not auto-finalize, auto-commit, auto-push, or run dependent tasks.",
  ].filter((line): line is string => line !== null);

  return lines.length > 4 ? lines.join("\n") : "";
}

export function markdownBody(text: string) {
  if (text.startsWith("---\n") || text.startsWith("---\r\n")) {
    const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
    if (match) {
      return text.slice(match[0].length);
    }
  }
  return text;
}

export function markdownTitle(text: string, path: string) {
  return firstMarkdownHeading(text) ?? numberedPromptParts(path)?.title ?? null;
}

export function firstMarkdownHeading(text: string) {
  const match = /^#\s+(.+)$/m.exec(text);
  return match?.[1].trim() || null;
}

export function numberedPromptParts(path: string) {
  const match = NUMBERED_PROMPT_PATTERN.exec(path.replace(/\\/g, "/"));
  if (!match?.groups) {
    return null;
  }
  const order = match.groups.order;
  const slug = match.groups.slug;
  return {
    id: order,
    numericOrder: Number.parseFloat(order),
    title: humanizeSlug(slug),
  };
}

export function basename(path: string) {
  return path.split("/").pop() ?? path;
}

export function parentDirectory(path: string | undefined) {
  if (!path) {
    return null;
  }
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? humanizeSlug(parts[parts.length - 2]) : null;
}

export function stringValue(record: UnknownRecord | null, keys: string[]) {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function numberValue(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function stringList(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const list = normalizeListValue(value);
    if (list.length > 0) {
      return list;
    }
  }
  return [];
}

export function normalizePriority(priority: number | null) {
  if (priority === null || !Number.isFinite(priority)) {
    return 3;
  }
  return Math.min(5, Math.max(0, Math.round(priority)));
}

export function normalizeDependencyPolicy(
  value: string | null,
): PromptPackDependencyPolicy | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (
    normalized === "hard_numeric_order" ||
    normalized === "numeric_order" ||
    normalized === "sequential"
  ) {
    return "hard_numeric_order";
  }
  if (normalized === "explicit_only") {
    return "explicit_only";
  }
  if (
    normalized === "suggest_numeric_order" ||
    normalized === "numeric_suggestions"
  ) {
    return "suggest_numeric_order";
  }
  return null;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function humanizeSlug(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : "Invalid JSON.";
}

function sectionLines(title: string, values: string[]) {
  return values.length > 0 ? [title, ...values.map((value) => `- ${value}`)] : [];
}

function normalizeListValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}
