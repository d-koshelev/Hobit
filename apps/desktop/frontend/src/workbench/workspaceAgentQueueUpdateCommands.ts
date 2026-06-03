import type { QueueUpdateItemPatch } from "./queue/agentQueueWidgetApiTypes";
import {
  APPROVAL_POLICIES,
  SANDBOXES,
  UPDATE_STATUSES,
} from "./workspaceAgentQueueCommandText";
import {
  escapeRegExp,
  fencedPrompt,
  isOneOf,
} from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandTypes";

export function parseUpdateCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  const updateMatch =
    text.match(/^update\s+task\s+(\S+)\s*([\s\S]*)$/i) ??
    text.match(/^\u043e\u0431\u043d\u043e\u0432\u0438\s+\u0437\u0430\u0434\u0430\u0447\u0443\s+(\S+)\s*([\s\S]*)$/i);
  if (updateMatch) {
    return updateCommandFromTargetAndBody(
      updateMatch[1] ?? "",
      updateMatch[2] ?? "",
    );
  }

  const renameMatch =
    text.match(/^rename\s+task\s+(\S+)\s*([\s\S]*)$/i) ??
    text.match(/^\u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u0443\u0439\s+\u0437\u0430\u0434\u0430\u0447\u0443\s+(\S+)\s*([\s\S]*)$/i);
  if (renameMatch) {
    const title = (renameMatch[2] ?? "").replace(/^title\s*/i, "").trim();

    return {
      changedFieldLabels: title ? ["title"] : [],
      patch: title ? { title } : {},
      target: renameMatch[1] ?? "",
      type: "updateItem",
    };
  }

  const setStatusMatch = text.match(/^set\s+task\s+(\S+)\s+to\s+(\S+)\s*$/i);
  if (setStatusMatch) {
    const status = normalizedStatus(setStatusMatch[2] ?? "");

    return {
      changedFieldLabels: status ? ["status"] : [],
      patch: status ? { status } : {},
      target: setStatusMatch[1] ?? "",
      type: "updateItem",
    };
  }

  const promptMatch =
    text.match(/^change\s+prompt\s+for\s+task\s+(\S+)\s*([\s\S]*)$/i);
  if (promptMatch) {
    const prompt = promptMatch[2]?.trim() ?? "";

    return {
      changedFieldLabels: prompt ? ["prompt"] : [],
      patch: prompt ? { prompt } : {},
      target: promptMatch[1] ?? "",
      type: "updateItem",
    };
  }

  return null;
}

function updateCommandFromTargetAndBody(
  target: string,
  body: string,
): WorkspaceAgentQueueCommand {
  const patch: QueueUpdateItemPatch = {};
  const changedFieldLabels: string[] = [];
  const trimmedBody = body.trim();

  applyTextField(
    patch,
    changedFieldLabels,
    "title",
    singleFieldBody(trimmedBody, "title"),
  );
  applyTextField(
    patch,
    changedFieldLabels,
    "description",
    labeledValue(trimmedBody, ["description"]),
  );
  applyTextField(
    patch,
    changedFieldLabels,
    "prompt",
    fencedPrompt(trimmedBody) ?? singleFieldBody(trimmedBody, "prompt"),
  );
  applyStatusField(
    patch,
    changedFieldLabels,
    labeledValue(trimmedBody, ["status"]) ||
      singleFieldBody(trimmedBody, "status") ||
      statusAfterTo(trimmedBody),
  );
  applyNumberField(
    patch,
    changedFieldLabels,
    "priority",
    singleFieldBody(trimmedBody, "priority"),
  );
  applyQueueTagField(
    patch,
    changedFieldLabels,
    labeledValue(trimmedBody, ["queue tag", "tag"]) ||
      singleFieldBody(trimmedBody, "queue tag") ||
      singleFieldBody(trimmedBody, "tag"),
  );
  applyTextField(
    patch,
    changedFieldLabels,
    "executionWorkspace",
    labeledValue(trimmedBody, [
      "execution workspace",
      "task workspace",
      "workspace",
    ]) ||
      singleFieldBody(trimmedBody, "execution workspace") ||
      singleFieldBody(trimmedBody, "workspace"),
  );
  applyTextField(
    patch,
    changedFieldLabels,
    "codexExecutable",
    labeledValue(trimmedBody, ["codex executable", "codex"]) ||
      singleFieldBody(trimmedBody, "codex executable") ||
      singleFieldBody(trimmedBody, "codex"),
  );
  applySandboxField(
    patch,
    changedFieldLabels,
    labeledValue(trimmedBody, ["sandbox"]) ||
      singleFieldBody(trimmedBody, "sandbox"),
  );
  applyApprovalPolicyField(
    patch,
    changedFieldLabels,
    labeledValue(trimmedBody, ["approval policy", "approval"]) ||
      singleFieldBody(trimmedBody, "approval policy") ||
      singleFieldBody(trimmedBody, "approval"),
  );

  return {
    changedFieldLabels,
    patch,
    target,
    type: "updateItem",
  };
}

function singleFieldBody(body: string, label: string) {
  const pattern = new RegExp(`^${escapeRegExp(label)}\\s+([\\s\\S]+)$`, "i");
  return body.match(pattern)?.[1]?.trim() ?? "";
}

function labeledValue(text: string, labels: string[]) {
  const boundaries = [
    "title",
    "description",
    "prompt",
    "status",
    "priority",
    "queue tag",
    "tag",
    "execution workspace",
    "task workspace",
    "workspace",
    "sandbox",
    "approval policy",
    "approval",
    "codex executable",
    "codex",
  ].join("|");

  for (const label of labels) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(label)}\\s*[:=]\\s*(?:"([^"]+)"|'([^']+)'|([\\s\\S]*?)(?=(?:\\s+\\b(?:${boundaries})\\s*[:=])|[;\\n]|$))`,
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

function statusAfterTo(body: string) {
  return body.match(/\bto\s+(\S+)\s*$/i)?.[1]?.trim() ?? "";
}

function applyTextField<
  K extends
    | "title"
    | "description"
    | "prompt"
    | "executionWorkspace"
    | "codexExecutable",
>(
  patch: QueueUpdateItemPatch,
  changedFieldLabels: string[],
  field: K,
  value: string,
) {
  if (!value.trim()) {
    return;
  }

  patch[field] = value.trim();
  changedFieldLabels.push(fieldLabel(field));
}

function applyNumberField(
  patch: QueueUpdateItemPatch,
  changedFieldLabels: string[],
  field: "priority",
  value: string,
) {
  if (!value.trim()) {
    return;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return;
  }

  patch[field] = parsed;
  changedFieldLabels.push(fieldLabel(field));
}

function applyStatusField(
  patch: QueueUpdateItemPatch,
  changedFieldLabels: string[],
  value: string,
) {
  const status = normalizedStatus(value);
  if (!status) {
    return;
  }

  patch.status = status;
  changedFieldLabels.push("status");
}

function applyQueueTagField(
  patch: QueueUpdateItemPatch,
  changedFieldLabels: string[],
  value: string,
) {
  if (!value.trim()) {
    return;
  }

  patch.queueTag = { name: value.trim() };
  changedFieldLabels.push("queue tag");
}

function applySandboxField(
  patch: QueueUpdateItemPatch,
  changedFieldLabels: string[],
  value: string,
) {
  const normalized = value.trim().toLowerCase();
  if (!isOneOf(normalized, SANDBOXES)) {
    return;
  }

  patch.sandbox = normalized;
  changedFieldLabels.push("sandbox");
}

function applyApprovalPolicyField(
  patch: QueueUpdateItemPatch,
  changedFieldLabels: string[],
  value: string,
) {
  const normalized = value.trim().toLowerCase();
  if (!isOneOf(normalized, APPROVAL_POLICIES)) {
    return;
  }

  patch.approvalPolicy = normalized;
  changedFieldLabels.push("approval policy");
}

function normalizedStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  return isOneOf(normalized, UPDATE_STATUSES) ? normalized : null;
}

function fieldLabel(field: string) {
  switch (field) {
    case "codexExecutable":
      return "Codex executable";
    case "executionWorkspace":
      return "execution workspace";
    default:
      return field;
  }
}
