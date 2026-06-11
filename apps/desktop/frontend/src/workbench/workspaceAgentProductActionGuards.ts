import type { DirectWorkStreamEvent } from "../workspace/types";
import {
  promptPackPreviewFromSourceText,
  type PromptPackMaterializationResult,
  type WorkspaceAgentPromptPackImportState,
} from "./promptPack";
import type { CreateQueueItemsFromPromptPackPreview } from "./promptPack/WorkspaceAgentPromptPackImportCard";
import { errorToMessage } from "./workspaceAgentProviderGuards";

export const TYPED_PRODUCT_ACTION_UNAVAILABLE =
  "typed product action unavailable";

export const PRODUCT_ACTION_TOOL_LOOP_ATTEMPT_LIMIT = 2;

export type WorkspaceAgentProductActionConfirmationInput = {
  createQueueItemsFromPromptPackPreview?: CreateQueueItemsFromPromptPackPreview;
  imports: Record<string, WorkspaceAgentPromptPackImportState>;
  onPatchPromptPackImport: (
    importId: string,
    patch: Partial<WorkspaceAgentPromptPackImportState>,
  ) => void;
  text: string;
};

export type WorkspaceAgentProductActionConfirmationResult = {
  body: string;
  handled: boolean;
};

export type ProductActionToolLoopGuardState = {
  enabled: boolean;
  failedAttempts: number;
  stopped: boolean;
};

export type ProductActionToolLoopGuardResult = {
  attemptCount: number;
  command: string;
  message: string;
  shouldStop: boolean;
};

export async function runWorkspaceAgentProductActionConfirmation(
  input: WorkspaceAgentProductActionConfirmationInput,
): Promise<WorkspaceAgentProductActionConfirmationResult> {
  const latestImport = latestPromptPackImport(input.imports);
  const pendingImport =
    latestImport && !latestImport.result && !latestImport.isCancelled
      ? latestImport
      : null;
  const isPromptPackConfirmation = isPromptPackImportConfirmationText(
    input.text,
    Boolean(pendingImport),
  );

  if (!isPromptPackConfirmation && !isRawProductActionBypassText(input.text)) {
    return { body: "", handled: false };
  }

  if (!isPromptPackConfirmation) {
    return {
      body: unavailableProductActionMessage(
        "raw SQLite, shell, or ad hoc storage mutation is not a product action connector",
      ),
      handled: true,
    };
  }

  if (!latestImport) {
    return {
      body: unavailableProductActionMessage(
        "there is no active prompt-pack import preview to confirm",
      ),
      handled: true,
    };
  }

  if (latestImport.result) {
    return {
      body:
        "Prompt-pack import is already complete. No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.",
      handled: true,
    };
  }

  if (latestImport.isCancelled) {
    return {
      body:
        "Prompt-pack import was cancelled. No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.",
      handled: true,
    };
  }

  const preview = promptPackPreviewFromSourceText(latestImport.sourceText);
  if (!preview) {
    return {
      body:
        "Prompt-pack import confirmation was routed to the typed product action path, but the preview is not ready. Paste prompt-pack source in the import card. No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.",
      handled: true,
    };
  }

  if (!preview.importAvailable) {
    return {
      body: [
        "Prompt-pack import confirmation was routed to the typed product action path, but the preview has blocking errors.",
        preview.errors[0]?.message ?? "Fix the import preview before creating Queue items.",
        "No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.",
      ].join(" "),
      handled: true,
    };
  }

  if (!input.createQueueItemsFromPromptPackPreview) {
    return {
      body: unavailableProductActionMessage(
        "prompt-pack Queue item creation is not connected in this Workspace Agent surface",
      ),
      handled: true,
    };
  }

  try {
    const result = await input.createQueueItemsFromPromptPackPreview(preview);
    input.onPatchPromptPackImport(latestImport.id, { result });
    return {
      body: promptPackTypedActionResultMessage(result),
      handled: true,
    };
  } catch (error) {
    return {
      body: unavailableProductActionMessage(
        `prompt-pack Queue item creation failed through the typed connector: ${errorToMessage(
          error,
          "unknown failure",
        )}`,
      ),
      handled: true,
    };
  }
}

export function createProductActionToolLoopGuardState(
  promptText: string,
): ProductActionToolLoopGuardState {
  return {
    enabled: isRawProductActionBypassText(promptText),
    failedAttempts: 0,
    stopped: false,
  };
}

export function recordProductActionToolLoopAttempt(
  state: ProductActionToolLoopGuardState,
  event: DirectWorkStreamEvent,
): ProductActionToolLoopGuardResult | null {
  if (!state.enabled || state.stopped) {
    return null;
  }

  const command = failedForbiddenProductActionCommand(event);
  if (!command) {
    return null;
  }

  state.failedAttempts += 1;
  if (state.failedAttempts < PRODUCT_ACTION_TOOL_LOOP_ATTEMPT_LIMIT) {
    return {
      attemptCount: state.failedAttempts,
      command,
      message: "",
      shouldStop: false,
    };
  }

  state.stopped = true;
  return {
    attemptCount: state.failedAttempts,
    command,
    message: unavailableProductActionMessage(
      `missing typed product connector; stopped raw shell/SQLite product-action attempts after ${state.failedAttempts.toString()} failed attempts`,
    ),
    shouldStop: true,
  };
}

export function isPromptPackImportConfirmationText(
  text: string,
  hasPendingImport: boolean,
) {
  const normalized = normalize(text);
  if (!normalized) {
    return false;
  }

  const shortGenericConfirmation =
    normalized.length <= 80 &&
    /^(?:yes|y|ok|okay|confirm|confirmed|proceed|go ahead|do it|create|create them|create items|import|import it|apply|looks good)$/.test(
      normalized,
    );
  if (hasPendingImport && shortGenericConfirmation) {
    return true;
  }

  const mentionsPromptPack = /\bprompt[- ]?pack\b/.test(normalized);
  const mentionsImport = /\bimport\b/.test(normalized);
  const mentionsQueueItems = /\bcreate (?:the )?queue items?\b/.test(
    normalized,
  );
  const hasConfirmationVerb =
    /\b(confirm|confirmed|create|import|proceed|go ahead|apply|yes|ok|okay)\b/.test(
      normalized,
    );

  return (
    hasConfirmationVerb &&
    (mentionsPromptPack || mentionsQueueItems || mentionsImport)
  );
}

function latestPromptPackImport(
  imports: Record<string, WorkspaceAgentPromptPackImportState>,
) {
  return Object.values(imports).sort((left, right) =>
    left.id.localeCompare(right.id),
  ).slice(-1)[0] ?? null;
}

function unavailableProductActionMessage(reason: string) {
  return `${TYPED_PRODUCT_ACTION_UNAVAILABLE}: ${reason}. No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.`;
}

function promptPackTypedActionResultMessage(
  result: PromptPackMaterializationResult,
) {
  if (!result.ok) {
    return [
      "Prompt-pack import used the typed Queue action path, but Queue item creation reported a visible failure.",
      result.errors[0]?.message ?? "No Queue items were created.",
      "No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.",
    ].join(" ");
  }

  return `Prompt-pack import used the typed Queue action path. Created ${result.createdTasks.length.toString()} draft Queue item${result.createdTasks.length === 1 ? "" : "s"}. No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.`;
}

function isRawProductActionBypassText(text: string) {
  const normalized = normalize(text);
  if (!normalized || /\b(implement|fix|test|tests|guard|code|frontend|runtime|source|repo|bug|blocker)\b/.test(normalized)) {
    return false;
  }

  return (
    /\b(insert|synthesize|synthesise|create|write|manually add|raw)\b/.test(
      normalized,
    ) &&
    /\b(sqlite|database|db|node:sqlite|better-sqlite3)\b/.test(normalized) &&
    /\b(queue item|queue row|queue task|agent queue|prompt[- ]?pack import)\b/.test(
      normalized,
    )
  );
}

function failedForbiddenProductActionCommand(event: DirectWorkStreamEvent) {
  if (event.eventKind !== "codex_json_event") {
    return null;
  }

  const payload = parseJsonRecord(event.line);
  const item = recordValue(payload?.item) ?? payload;
  if (!commandExecutionFailed(item)) {
    return null;
  }

  const command = commandTextFromItem(item);
  return command && isForbiddenProductActionCommand(command) ? command : null;
}

function isForbiddenProductActionCommand(command: string) {
  const normalized = normalize(command);
  const sqliteLike =
    /\b(sqlite|sqlite3|better-sqlite3|node:sqlite)\b/.test(normalized) ||
    /\.(?:sqlite|sqlite3|db)\b/.test(normalized);
  const queueStorageLike =
    /\b(agent_queue|queue_items?|queue_tasks?|prompt_pack|prompt-pack|insert into|update)\b/.test(
      normalized,
    );
  const rgStorageProbe =
    /^rg\b/.test(normalized) &&
    /\b(agent_queue|queue_items?|queue_tasks?|prompt_pack|prompt-pack|\.sqlite|\.db)\b/.test(
      normalized,
    );

  return (sqliteLike && queueStorageLike) || rgStorageProbe;
}

function commandTextFromItem(item: JsonRecord | null) {
  if (!item) {
    return null;
  }

  const commandParts = stringArrayValue(item.command);
  if (commandParts.length > 0) {
    return commandParts.join(" ");
  }

  const command = stringValue(item.command) ?? stringValue(item.cmd);
  const args = stringArrayValue(item.args);
  if (command && args.length > 0) {
    return `${command} ${args.join(" ")}`;
  }

  return command ?? stringValue(item.command_line) ?? stringValue(item.title);
}

function commandExecutionFailed(item: JsonRecord | null) {
  if (!item) {
    return false;
  }

  const exitCode = numberValue(item.exit_code) ?? numberValue(item.exitCode);
  if (exitCode !== null) {
    return exitCode !== 0;
  }

  const status = stringValue(item.status)?.toLowerCase() ?? "";
  return (
    status.includes("failed") ||
    status.includes("error") ||
    Boolean(item.error || item.error_message)
  );
}

type JsonRecord = Record<string, unknown>;

function parseJsonRecord(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return recordValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function recordValue(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
