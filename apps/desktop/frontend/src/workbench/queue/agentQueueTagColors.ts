export type QueueTagColorToken =
  | "queue-flow-tag-1"
  | "queue-flow-tag-2"
  | "queue-flow-tag-3"
  | "queue-flow-tag-4"
  | "queue-flow-tag-5"
  | "queue-flow-tag-6";

export const QUEUE_TAG_COLOR_OPTIONS: readonly {
  label: string;
  token: QueueTagColorToken;
}[] = [
  { label: "Blue", token: "queue-flow-tag-1" },
  { label: "Cyan", token: "queue-flow-tag-2" },
  { label: "Green", token: "queue-flow-tag-3" },
  { label: "Amber", token: "queue-flow-tag-4" },
  { label: "Red", token: "queue-flow-tag-5" },
  { label: "Gray", token: "queue-flow-tag-6" },
];

export function isQueueTagColorToken(
  value: string,
): value is QueueTagColorToken {
  return QUEUE_TAG_COLOR_OPTIONS.some((option) => option.token === value);
}

export function queueTagColorToken(queueTagId: string): QueueTagColorToken {
  let hash = 0;

  for (const character of queueTagId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return (
    QUEUE_TAG_COLOR_OPTIONS[hash % QUEUE_TAG_COLOR_OPTIONS.length]?.token ??
    "queue-flow-tag-1"
  );
}
