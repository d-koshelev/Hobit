import type {
  RunCodexDirectWorkRequest,
  StartCodexDirectWorkStreamResponse,
} from "../workspace/types";

export type CodexDirectWorkRequestDraft = Omit<
  RunCodexDirectWorkRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type CodexDirectWorkStreamSession = StartCodexDirectWorkStreamResponse & {
  stopListening: () => void;
};
