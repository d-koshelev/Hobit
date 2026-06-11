import type { DirectWorkStreamEvent } from "../workspace/types";
import type { WorkspaceAgentPromptPackImportStartOptions } from "./useWorkspaceAgentPromptPackImport";
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
  onCancelPromptPackImport?: (importId: string) => void;
  onStartPromptPackImportPreview?: (
    operatorBody: string,
    options: WorkspaceAgentPromptPackImportStartOptions,
  ) => void;
  text: string;
};

export type WorkspaceAgentProductActionConfirmationResult = {
  body: string;
  handled: boolean;
  transcriptHandled?: boolean;
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

export type PromptPackImportIntentKind =
  | "start_prompt_pack_import_preview"
  | "confirm_prompt_pack_import_preview"
  | "cancel_prompt_pack_import_preview"
  | "unknown";

export type PromptPackImportIntent =
  | {
      kind: "start_prompt_pack_import_preview";
      source: WorkspaceAgentPromptPackImportStartOptions;
    }
  | { kind: "confirm_prompt_pack_import_preview" }
  | { kind: "cancel_prompt_pack_import_preview" }
  | { kind: "unknown" };

export async function runWorkspaceAgentProductActionConfirmation(
  input: WorkspaceAgentProductActionConfirmationInput,
): Promise<WorkspaceAgentProductActionConfirmationResult> {
  const latestImport = latestPromptPackImport(input.imports);
  const pendingImport =
    latestImport && !latestImport.result && !latestImport.isCancelled
      ? latestImport
      : null;
  const promptPackIntent = classifyPromptPackImportIntent(input.text, {
    hasPendingImport: Boolean(pendingImport),
  });
  if (promptPackIntent.kind === "start_prompt_pack_import_preview") {
    if (!input.onStartPromptPackImportPreview) {
      return {
        body: unavailableProductActionMessage(
          "prompt-pack import preview creation is not connected in this Workspace Agent surface",
        ),
        handled: true,
      };
    }
    input.onStartPromptPackImportPreview(input.text, promptPackIntent.source);
    return {
      body: "",
      handled: true,
      transcriptHandled: true,
    };
  }

  if (promptPackIntent.kind === "cancel_prompt_pack_import_preview") {
    return cancelPromptPackImport(input, pendingImport);
  }

  const isPromptPackConfirmation =
    promptPackIntent.kind === "confirm_prompt_pack_import_preview";

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

  if (!pendingImport) {
    return {
      body: unavailableProductActionMessage(
        "there is no active prompt-pack import preview to confirm",
      ),
      handled: true,
    };
  }

  const preview = promptPackPreviewFromSourceText(pendingImport.sourceText);
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
    input.onPatchPromptPackImport(pendingImport.id, { result });
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

export function runWorkspaceAgentProductActionCancel(
  input: WorkspaceAgentProductActionConfirmationInput,
): WorkspaceAgentProductActionConfirmationResult {
  const latestImport = latestPromptPackImport(input.imports);
  const pendingImport =
    latestImport && !latestImport.result && !latestImport.isCancelled
      ? latestImport
      : null;
  const promptPackIntent = classifyPromptPackImportIntent(input.text, {
    hasPendingImport: Boolean(pendingImport),
  });

  if (promptPackIntent.kind !== "cancel_prompt_pack_import_preview") {
    return { body: "", handled: false };
  }

  return cancelPromptPackImport(input, pendingImport);
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
  return (
    classifyPromptPackImportIntent(text, { hasPendingImport }).kind ===
    "confirm_prompt_pack_import_preview"
  );
}

export function classifyPromptPackImportIntent(
  text: string,
  options: { hasPendingImport: boolean },
): PromptPackImportIntent {
  const normalized = normalize(text);
  if (!normalized) {
    return { kind: "unknown" };
  }

  if (isRawProductActionBypassText(text)) {
    return { kind: "unknown" };
  }

  if (isOrdinaryCodeImportPrompt(normalized)) {
    return { kind: "unknown" };
  }

  const source = extractPromptPackImportStartSource(text);
  const mentionsPromptPack = /\bprompt[- ]?pack\b/.test(normalized);
  const mentionsImport = /\bimport\b/.test(normalized);
  const mentionsPreview = /\bpreview\b/.test(normalized);
  const mentionsPromptPackImportSubject =
    mentionsPromptPack || /\bprompt[- ]?batch\b/.test(normalized);
  const mentionsQueueItems = /\bcreate (?:the )?queue items?\b/.test(
    normalized,
  );
  const previewBeforeCreateCue =
    /\b(show preview first|preview first|before creating|before create|until i confirm|wait for confirmation|do not create)\b/.test(
      normalized,
    );
  const shortGenericConfirmation =
    normalized.length <= 80 &&
    /^(?:yes|y|ok|okay|confirm|confirmed|proceed|go ahead|do it|create|create them|create items|import it|apply|looks good)$/.test(
      normalized,
    );
  if (options.hasPendingImport && shortGenericConfirmation) {
    return { kind: "confirm_prompt_pack_import_preview" };
  }

  const hasConfirmationVerb =
    /\b(confirm|confirmed|create|proceed|go ahead|apply|yes|ok|okay)\b/.test(
      normalized,
    );
  const preciseConfirmation =
    hasConfirmationVerb &&
    (mentionsPromptPack || mentionsQueueItems || /\bconfirm (?:the )?import\b/.test(normalized));
  if (!previewBeforeCreateCue && preciseConfirmation) {
    return { kind: "confirm_prompt_pack_import_preview" };
  }

  const startCue =
    (/\b(start|begin|preview|show preview)\b/.test(normalized) &&
      (mentionsPromptPackImportSubject || mentionsImport || mentionsPreview)) ||
    (mentionsImport &&
      (mentionsPromptPackImportSubject ||
        mentionsPreview ||
        Boolean(source.sourcePath) ||
        Boolean(source.sourceText)));
  const cancelCue = /\b(cancel|discard|stop)\b/.test(normalized);

  if (
    cancelCue &&
    (options.hasPendingImport || mentionsPromptPack || mentionsImport || mentionsPreview)
  ) {
    return { kind: "cancel_prompt_pack_import_preview" };
  }

  if (
    (startCue || previewBeforeCreateCue) &&
    (mentionsPromptPackImportSubject || mentionsImport || mentionsPreview)
  ) {
    return {
      kind: "start_prompt_pack_import_preview",
      source,
    };
  }

  if (
    hasConfirmationVerb &&
    (mentionsPromptPack || mentionsQueueItems || mentionsImport)
  ) {
    return { kind: "confirm_prompt_pack_import_preview" };
  }

  return { kind: "unknown" };
}

export function extractPromptPackImportStartSource(
  text: string,
): WorkspaceAgentPromptPackImportStartOptions {
  const fencedSource = text.match(/```(?:json|markdown|md)?\s*\r?\n([\s\S]*?)```/i)?.[1];
  if (fencedSource?.trim()) {
    return { sourceText: fencedSource.trim() };
  }

  const blocks = text
    .split(/\r?\n\s*\r?\n/g)
    .map((block) => block.trim())
    .filter(Boolean);
  const trailingBlock = blocks.length > 1 ? blocks[blocks.length - 1] : "";
  if (trailingBlock && looksLikePromptPackSourceText(trailingBlock)) {
    return { sourceText: trailingBlock };
  }

  const sourcePath = extractSourcePath(text);
  if (sourcePath) {
    return {
      sourcePath,
      sourceUnavailableReason:
        "No safe prompt-pack folder or zip reader is wired. Paste prompt-batch JSON or a numbered Markdown prompt in the import card.",
    };
  }

  return {};
}

function cancelPromptPackImport(
  input: WorkspaceAgentProductActionConfirmationInput,
  pendingImport: WorkspaceAgentPromptPackImportState | null,
): WorkspaceAgentProductActionConfirmationResult {
  if (!pendingImport) {
    return {
      body: unavailableProductActionMessage(
        "there is no active prompt-pack import preview to cancel",
      ),
      handled: true,
    };
  }

  input.onCancelPromptPackImport?.(pendingImport.id);
  return {
    body:
      "Prompt-pack import preview was cancelled. No Queue items were created. No Codex run, shell command, SQLite write, Queue Autorun, Terminal command, commit, or push was started.",
    handled: true,
  };
}

function looksLikePromptPackSourceText(text: string) {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    /^\d+[.)-]\s+\S/.test(trimmed) ||
    /^#\s+\S/.test(trimmed)
  );
}

function extractSourcePath(text: string) {
  const windowsPath =
    text.match(/[A-Za-z]:\\[^\r\n]+/)?.[0] ??
    text.match(/["']([A-Za-z]:\\[^"'\r\n]+)["']/)?.[1];
  if (windowsPath) {
    return trimSourcePath(windowsPath);
  }

  const unixPath =
    text.match(/(?:^|\s)(\/(?:[^/\s]+\/?)+[^\s.,;:]?)/)?.[1] ??
    text.match(/["'](\/[^"'\r\n]+)["']/)?.[1];
  return unixPath ? trimSourcePath(unixPath) : undefined;
}

function trimSourcePath(path: string) {
  return path.trim().replace(/[.,;:]+$/, "");
}

function isOrdinaryCodeImportPrompt(normalized: string) {
  return (
    /^import\s+(?:[{*]|type\b)/.test(normalized) ||
    /\bfrom\s+["'][^"']+["']/.test(normalized) ||
    /\b(typescript|javascript|python|module|modules|dependency|dependencies|implementation|code|repo|source file)\b/.test(
      normalized,
    )
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
