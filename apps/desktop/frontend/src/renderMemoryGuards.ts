export type CappedText = {
  isCapped: boolean;
  omittedChars: number;
  text: string;
};

export const RENDER_MEMORY_CAPS = {
  activityRenderedEvents: 100,
  activityRetainedEvents: 120,
  directWorkLogRenderedEvents: 160,
  eventRows: 100,
  evidenceRawDetailsChars: 6_000,
  knowledgePreviewChars: 4_000,
  rawJsonPreviewChars: 3_000,
  stdoutStderrPreviewChars: 3_000,
  transcriptMessageChars: 8_000,
  transcriptPayloadChars: 4_000,
  widgetLogMessageChars: 1_000,
  widgetLogRows: 80,
} as const;

export function capText(value: string, maxChars: number): CappedText {
  if (value.length <= maxChars) {
    return {
      isCapped: false,
      omittedChars: 0,
      text: value,
    };
  }

  return {
    isCapped: true,
    omittedChars: value.length - maxChars,
    text: value.slice(0, maxChars).trimEnd(),
  };
}

export function capTextEnd(value: string, maxChars: number): CappedText {
  if (value.length <= maxChars) {
    return {
      isCapped: false,
      omittedChars: 0,
      text: value,
    };
  }

  return {
    isCapped: true,
    omittedChars: value.length - maxChars,
    text: value.slice(value.length - maxChars).trimStart(),
  };
}

export function cappedPreviewText(
  value: string,
  maxChars: number,
  cappedLabel = "Preview capped",
) {
  const capped = capText(value, maxChars);

  return capped.isCapped
    ? `${capped.text}\n[${cappedLabel}: ${capped.omittedChars.toString()} character(s) omitted.]`
    : capped.text;
}

export function cappedRawDetailsText(value: string, maxChars: number) {
  return cappedPreviewText(value, maxChars, "Raw details capped");
}

export function cappedTailPreviewText(
  value: string,
  maxChars: number,
  cappedLabel = "Preview capped",
) {
  const capped = capTextEnd(value, maxChars);

  return capped.isCapped
    ? `[${cappedLabel}: showing last ${maxChars.toString()} character(s); ${capped.omittedChars.toString()} omitted.]\n${capped.text}`
    : capped.text;
}

export function capArrayToLast<T>(items: T[], maxItems: number) {
  if (items.length <= maxItems) {
    return {
      hiddenCount: 0,
      items,
    };
  }

  return {
    hiddenCount: items.length - maxItems,
    items: items.slice(-maxItems),
  };
}
