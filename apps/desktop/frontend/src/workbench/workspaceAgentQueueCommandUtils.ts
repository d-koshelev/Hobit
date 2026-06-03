export function startsWithAnyPhrase(text: string, phrases: string[]) {
  return phrases.some((phrase) => stripLeadingPhrase(text, [phrase]) !== null);
}

export function stripLeadingPhrase(text: string, phrases: string[]) {
  const trimmed = text.trim();
  const normalized = trimmed.toLowerCase();

  for (const phrase of phrases) {
    if (normalized === phrase) {
      return "";
    }

    if (
      normalized.startsWith(`${phrase} `) ||
      normalized.startsWith(`${phrase}:`) ||
      normalized.startsWith(`${phrase}-`)
    ) {
      return trimmed.slice(phrase.length).replace(/^[:\-\s]+/, "");
    }
  }

  return null;
}

export function fencedPrompt(text: string) {
  const match = text.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/);
  const prompt = match?.[1]?.trim();
  return prompt || null;
}

export function stripFenceBlocks(text: string) {
  return text.replace(/```[\s\S]*?```/g, " ").trim();
}

export function firstSentence(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^(.+?)(?:[.!?](?:\s|$)|$)/);
  return compactTitle(match?.[1] ?? normalized);
}

export function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

export function timestampValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return allowed.some((entry) => entry === value);
}

export function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown Queue command error.";
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 96
    ? normalized
    : `${normalized.slice(0, 95).trim()}...`;
}
