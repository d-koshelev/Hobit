import type {
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import type {
  QueueCreateItemRequest,
  QueueUpdateItemRequest,
} from "./queue/agentQueueWidgetApiTypes";

export type WorkspaceAgentQueueIntentType = "createItem" | "updateItem";

export type WorkspaceAgentQueueCreateIntentDraft = {
  approvalPolicy: DirectWorkApprovalPolicy | "";
  codexExecutable: string;
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionWorkspace: string;
  id: string;
  intentType: "createItem";
  priority: string;
  prompt: string;
  queueTag: string;
  sandbox: DirectWorkSandbox | "";
  source: "local_text" | "provider_text";
  status: Extract<AgentQueueTaskStatus, "draft" | "queued">;
  title: string;
};

export type WorkspaceAgentQueueUpdateIntentDraft = {
  approvalPolicy: DirectWorkApprovalPolicy | "";
  codexExecutable: string;
  dependencies: string[];
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy | "";
  executionWorkspace: string;
  id: string;
  intentType: "updateItem";
  itemId: string;
  priority: string;
  prompt: string;
  queueTag: string;
  sandbox: DirectWorkSandbox | "";
  source: "local_text" | "provider_text";
  status: AgentQueueTaskStatus | "";
  title: string;
};

export type WorkspaceAgentQueueIntentDraft =
  | WorkspaceAgentQueueCreateIntentDraft
  | WorkspaceAgentQueueUpdateIntentDraft;

export type WorkspaceAgentQueueIntentValidation = {
  blockingMessages: string[];
  missingRequiredFields: string[];
  missingRunSettings: string[];
};

type QueueIntentParseOptions = {
  includePlainTextIntents?: boolean;
  source?: WorkspaceAgentQueueIntentDraft["source"];
};

const QUEUE_INTENT_BLOCK_PATTERN =
  /```hobit-queue-intent\s*([\s\S]*?)```/gi;

const CREATE_INTENT_PATTERN =
  /\b(?:draft|prepare|prefill)\s+(?:a\s+)?queue\s+(?:create\s+)?intent\b|\bqueue\s+create\s+intent\b/i;

const UPDATE_INTENT_PATTERN =
  /\b(?:draft|prepare|prefill)\s+(?:a\s+)?queue\s+update\s+intent\b|\bqueue\s+update\s+intent\b/i;

const LABELED_VALUE_BOUNDARY = [
  "item id",
  "target item id",
  "target",
  "title",
  "description",
  "prompt",
  "queue tag",
  "tag",
  "priority",
  "status",
  "initial status",
  "execution policy",
  "policy",
  "execution workspace",
  "task workspace",
  "workspace",
  "codex executable",
  "codex",
  "sandbox",
  "approval policy",
  "approval",
  "dependencies",
  "depends on",
].join("|");

const EXECUTION_POLICIES: AgentQueueTaskExecutionPolicy[] = [
  "manual",
  "auto",
  "after_previous_success",
];

const CREATE_STATUSES: Array<Extract<AgentQueueTaskStatus, "draft" | "queued">> =
  ["draft", "queued"];

const UPDATE_STATUSES: AgentQueueTaskStatus[] = [
  "draft",
  "queued",
  "ready",
  "running",
  "completed",
  "failed",
  "cancelled",
  "review_needed",
];

const SANDBOXES: DirectWorkSandbox[] = [
  "read_only",
  "workspace_write",
  "danger_full_access",
];

const APPROVAL_POLICIES: DirectWorkApprovalPolicy[] = [
  "never",
  "on_request",
  "untrusted",
];

export function emptyWorkspaceAgentQueueCreateIntentDraft(
  id: string,
  source: WorkspaceAgentQueueIntentDraft["source"],
): WorkspaceAgentQueueCreateIntentDraft {
  return {
    approvalPolicy: "",
    codexExecutable: "",
    description: "",
    executionPolicy: "manual",
    executionWorkspace: "",
    id,
    intentType: "createItem",
    priority: "0",
    prompt: "",
    queueTag: "",
    sandbox: "",
    source,
    status: "draft",
    title: "",
  };
}

export function emptyWorkspaceAgentQueueUpdateIntentDraft(
  id: string,
  source: WorkspaceAgentQueueIntentDraft["source"],
): WorkspaceAgentQueueUpdateIntentDraft {
  return {
    approvalPolicy: "",
    codexExecutable: "",
    dependencies: [],
    description: "",
    executionPolicy: "",
    executionWorkspace: "",
    id,
    intentType: "updateItem",
    itemId: "",
    priority: "",
    prompt: "",
    queueTag: "",
    sandbox: "",
    source,
    status: "",
    title: "",
  };
}

export function workspaceAgentQueueIntentDraftsFromText(
  text: string,
  sourceMessageId: string,
  options: QueueIntentParseOptions = {},
): WorkspaceAgentQueueIntentDraft[] {
  const visibleText = text.trim();
  if (!visibleText) {
    return [];
  }

  const source = options.source ?? "local_text";
  const drafts = queueIntentBlocksFromText(visibleText, sourceMessageId, source);

  if (drafts.length > 0 || !options.includePlainTextIntents) {
    return drafts;
  }

  const plainTextDraft = queueIntentPlainTextDraft(
    visibleText,
    sourceMessageId,
    source,
  );

  return plainTextDraft ? [plainTextDraft] : [];
}

export function validateWorkspaceAgentQueueIntentDraft(
  draft: WorkspaceAgentQueueIntentDraft,
): WorkspaceAgentQueueIntentValidation {
  if (draft.intentType === "createItem") {
    const missingRequiredFields = [
      draft.title.trim() ? "" : "title",
      draft.prompt.trim() ? "" : "prompt",
    ].filter(Boolean);
    const missingRunSettings =
      draft.status === "queued"
        ? [
            draft.executionWorkspace.trim() ? "" : "execution workspace",
            draft.codexExecutable.trim() ? "" : "Codex executable",
            draft.sandbox ? "" : "sandbox",
            draft.approvalPolicy ? "" : "approval policy",
          ].filter(Boolean)
        : [];

    return {
      blockingMessages: [
        missingRequiredFields.length > 0
          ? `Missing required fields: ${missingRequiredFields.join(", ")}.`
          : "",
        missingRunSettings.length > 0
          ? `Queued drafts need run settings before apply: ${missingRunSettings.join(", ")}.`
          : "",
      ].filter(Boolean),
      missingRequiredFields,
      missingRunSettings,
    };
  }

  const missingRequiredFields = draft.itemId.trim()
    ? []
    : ["target item id"];
  const hasPatch = workspaceAgentQueueIntentUpdateHasPatch(draft);

  return {
    blockingMessages: [
      missingRequiredFields.length > 0
        ? `Missing required fields: ${missingRequiredFields.join(", ")}.`
        : "",
      !hasPatch ? "At least one field must be changed before apply." : "",
    ].filter(Boolean),
    missingRequiredFields,
    missingRunSettings: [],
  };
}

export function workspaceAgentQueueIntentCanApply(
  draft: WorkspaceAgentQueueIntentDraft,
) {
  return validateWorkspaceAgentQueueIntentDraft(draft).blockingMessages.length === 0;
}

export function workspaceAgentQueueCreateRequestFromIntentDraft(
  draft: WorkspaceAgentQueueCreateIntentDraft,
): Omit<QueueCreateItemRequest, "workspaceId"> {
  const request: Omit<QueueCreateItemRequest, "workspaceId"> = {
    description: draft.description,
    executionPolicy: draft.executionPolicy,
    priority: parsePriority(draft.priority, 0),
    prompt: draft.prompt,
    status: draft.status,
    title: draft.title.trim(),
  };

  const queueTag = draft.queueTag.trim();
  if (queueTag) {
    request.queueTag = { name: queueTag };
  }

  const executionWorkspace = draft.executionWorkspace.trim();
  if (executionWorkspace) {
    request.executionWorkspace = executionWorkspace;
  }

  const codexExecutable = draft.codexExecutable.trim();
  if (codexExecutable) {
    request.codexExecutable = codexExecutable;
  }

  if (draft.sandbox) {
    request.sandbox = draft.sandbox;
  }

  if (draft.approvalPolicy) {
    request.approvalPolicy = draft.approvalPolicy;
  }

  return request;
}

export function workspaceAgentQueueUpdateRequestFromIntentDraft(
  draft: WorkspaceAgentQueueUpdateIntentDraft,
): Omit<QueueUpdateItemRequest, "workspaceId"> {
  const patch: Omit<QueueUpdateItemRequest, "workspaceId">["patch"] = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  const prompt = draft.prompt.trim();
  const queueTag = draft.queueTag.trim();
  const executionWorkspace = draft.executionWorkspace.trim();
  const codexExecutable = draft.codexExecutable.trim();

  if (title) {
    patch.title = title;
  }

  if (description) {
    patch.description = draft.description;
  }

  if (prompt) {
    patch.prompt = draft.prompt;
  }

  if (queueTag) {
    patch.queueTag = { name: queueTag };
  }

  if (draft.priority.trim()) {
    patch.priority = parsePriority(draft.priority, 0);
  }

  if (draft.status) {
    patch.status = draft.status;
  }

  if (draft.executionPolicy) {
    patch.executionPolicy = draft.executionPolicy;
  }

  if (executionWorkspace) {
    patch.executionWorkspace = executionWorkspace;
  }

  if (codexExecutable) {
    patch.codexExecutable = codexExecutable;
  }

  if (draft.sandbox) {
    patch.sandbox = draft.sandbox;
  }

  if (draft.approvalPolicy) {
    patch.approvalPolicy = draft.approvalPolicy;
  }

  if (draft.dependencies.length > 0) {
    patch.dependencies = draft.dependencies;
  }

  return {
    itemId: draft.itemId.trim(),
    patch,
  };
}

export function workspaceAgentQueueIntentUpdateHasPatch(
  draft: WorkspaceAgentQueueUpdateIntentDraft,
) {
  return (
    Object.keys(workspaceAgentQueueUpdateRequestFromIntentDraft(draft).patch)
      .length > 0
  );
}

export function workspaceAgentQueueIntentTitle(
  draft: WorkspaceAgentQueueIntentDraft,
) {
  if (draft.intentType === "createItem") {
    return "Draft Queue item";
  }

  return "Draft Queue update";
}

export function workspaceAgentQueueIntentPromptPreview(
  draft: WorkspaceAgentQueueIntentDraft,
) {
  const prompt = draft.prompt.trim();
  if (!prompt) {
    return "No prompt drafted.";
  }

  return compact(prompt, 180);
}

function queueIntentBlocksFromText(
  text: string,
  sourceMessageId: string,
  source: WorkspaceAgentQueueIntentDraft["source"],
) {
  const drafts: WorkspaceAgentQueueIntentDraft[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  QUEUE_INTENT_BLOCK_PATTERN.lastIndex = 0;
  while ((match = QUEUE_INTENT_BLOCK_PATTERN.exec(text))) {
    const parsed = parseJson(match[1]);
    const entries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    entries.forEach((entry) => {
      const draft = queueIntentRecordToDraft(
        entry,
        `${sourceMessageId}-queue-intent-${index.toString()}`,
        source,
      );
      index += 1;
      if (draft) {
        drafts.push(draft);
      }
    });
  }

  return drafts;
}

function queueIntentRecordToDraft(
  value: unknown,
  id: string,
  source: WorkspaceAgentQueueIntentDraft["source"],
): WorkspaceAgentQueueIntentDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = normalizedIntentType(stringField(value.type ?? value.intentType));
  if (type === "createItem") {
    return {
      ...emptyWorkspaceAgentQueueCreateIntentDraft(id, source),
      approvalPolicy: approvalPolicyField(value.approvalPolicy),
      codexExecutable: stringField(value.codexExecutable),
      description: stringField(value.description),
      executionPolicy: executionPolicyField(value.executionPolicy) ?? "manual",
      executionWorkspace: stringField(value.executionWorkspace),
      priority: priorityField(value.priority, "0"),
      prompt: stringField(value.prompt),
      queueTag: queueTagField(value.queueTag),
      sandbox: sandboxField(value.sandbox),
      status: createStatusField(value.status ?? value.initialStatus),
      title: stringField(value.title),
    };
  }

  if (type === "updateItem") {
    return {
      ...emptyWorkspaceAgentQueueUpdateIntentDraft(id, source),
      approvalPolicy: approvalPolicyField(value.approvalPolicy),
      codexExecutable: stringField(value.codexExecutable),
      dependencies: dependenciesField(value.dependencies),
      description: stringField(value.description),
      executionPolicy: executionPolicyField(value.executionPolicy) ?? "",
      executionWorkspace: stringField(value.executionWorkspace),
      itemId:
        stringField(value.itemId) ||
        stringField(value.targetItemId) ||
        stringField(value.target),
      priority: priorityField(value.priority, ""),
      prompt: stringField(value.prompt),
      queueTag: queueTagField(value.queueTag),
      sandbox: sandboxField(value.sandbox),
      status: updateStatusField(value.status),
      title: stringField(value.title),
    };
  }

  return null;
}

function queueIntentPlainTextDraft(
  text: string,
  sourceMessageId: string,
  source: WorkspaceAgentQueueIntentDraft["source"],
): WorkspaceAgentQueueIntentDraft | null {
  if (UPDATE_INTENT_PATTERN.test(text)) {
    return {
      ...emptyWorkspaceAgentQueueUpdateIntentDraft(
        `${sourceMessageId}-queue-intent-0`,
        source,
      ),
      approvalPolicy: approvalPolicyField(labeledValue(text, ["approval policy", "approval"])),
      codexExecutable: labeledValue(text, ["codex executable", "codex"]),
      dependencies: dependenciesField(labeledValue(text, ["dependencies", "depends on"])),
      description: labeledValue(text, ["description"]),
      executionPolicy:
        executionPolicyField(labeledValue(text, ["execution policy", "policy"])) ??
        "",
      executionWorkspace: labeledValue(text, [
        "execution workspace",
        "task workspace",
        "workspace",
      ]),
      itemId: labeledValue(text, ["item id", "target item id", "target"]),
      priority: priorityField(labeledValue(text, ["priority"]), ""),
      prompt: labeledValue(text, ["prompt"]),
      queueTag: labeledValue(text, ["queue tag", "tag"]),
      sandbox: sandboxField(labeledValue(text, ["sandbox"])),
      status: updateStatusField(labeledValue(text, ["status"])),
      title: labeledValue(text, ["title"]),
    };
  }

  if (CREATE_INTENT_PATTERN.test(text)) {
    return {
      ...emptyWorkspaceAgentQueueCreateIntentDraft(
        `${sourceMessageId}-queue-intent-0`,
        source,
      ),
      approvalPolicy: approvalPolicyField(labeledValue(text, ["approval policy", "approval"])),
      codexExecutable: labeledValue(text, ["codex executable", "codex"]),
      description: labeledValue(text, ["description"]),
      executionPolicy:
        executionPolicyField(labeledValue(text, ["execution policy", "policy"])) ??
        "manual",
      executionWorkspace: labeledValue(text, [
        "execution workspace",
        "task workspace",
        "workspace",
      ]),
      priority: priorityField(labeledValue(text, ["priority"]), "0"),
      prompt: labeledValue(text, ["prompt"]),
      queueTag: labeledValue(text, ["queue tag", "tag"]),
      sandbox: sandboxField(labeledValue(text, ["sandbox"])),
      status: createStatusField(
        labeledValue(text, ["initial status", "status"]),
      ),
      title: labeledValue(text, ["title"]),
    };
  }

  return null;
}

function normalizedIntentType(value: string): WorkspaceAgentQueueIntentType | "" {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "createitem" ||
    normalized === "create_item" ||
    normalized === "create" ||
    normalized === "queue.createitem" ||
    normalized === "queue.create_item"
  ) {
    return "createItem";
  }

  if (
    normalized === "updateitem" ||
    normalized === "update_item" ||
    normalized === "update" ||
    normalized === "queue.updateitem" ||
    normalized === "queue.update_item"
  ) {
    return "updateItem";
  }

  return "";
}

function labeledValue(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(label)}\\s*[:=]\\s*(?:"([^"]+)"|'([^']+)'|([\\s\\S]*?)(?=(?:\\s+\\b(?:${LABELED_VALUE_BOUNDARY})\\s*[:=])|[;\\n]|$))`,
      "i",
    );
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[2] ?? match?.[3];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function createStatusField(value: unknown) {
  const normalized = stringField(value).toLowerCase();
  return isOneOf(normalized, CREATE_STATUSES) ? normalized : "draft";
}

function updateStatusField(value: unknown) {
  const normalized = stringField(value).toLowerCase();
  return isOneOf(normalized, UPDATE_STATUSES) ? normalized : "";
}

function executionPolicyField(value: unknown) {
  const normalized = stringField(value).toLowerCase();
  return isOneOf(normalized, EXECUTION_POLICIES) ? normalized : null;
}

function sandboxField(value: unknown) {
  const normalized = stringField(value).toLowerCase();
  return isOneOf(normalized, SANDBOXES) ? normalized : "";
}

function approvalPolicyField(value: unknown) {
  const normalized = stringField(value).toLowerCase();
  return isOneOf(normalized, APPROVAL_POLICIES) ? normalized : "";
}

function priorityField(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  const text = stringField(value);
  return text ? text : fallback;
}

function queueTagField(value: unknown) {
  if (isRecord(value)) {
    return stringField(value.name) || stringField(value.id);
  }

  return stringField(value);
}

function dependenciesField(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(stringField).filter(Boolean);
  }

  return stringField(value)
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePriority(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value.trim()) as unknown;
  } catch {
    return null;
  }
}

function stringField(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return allowed.some((entry) => entry === value);
}

function compact(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 1).trim()}...`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
