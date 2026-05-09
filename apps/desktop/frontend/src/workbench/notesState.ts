export type NotesState = {
  body: string;
};

export function parseNotesState(rawState: unknown): NotesState {
  if (!isRecord(rawState)) {
    return emptyNotesState();
  }

  return {
    body: typeof rawState.body === "string" ? rawState.body : "",
  };
}

export function serializeNotesState(body: string): NotesState {
  return { body };
}

function emptyNotesState(): NotesState {
  return { body: "" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
