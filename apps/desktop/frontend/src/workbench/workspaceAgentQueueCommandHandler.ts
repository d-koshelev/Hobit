import type {
  AgentQueueTaskStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import type {
  QueueUpdateItemPatch,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import {
  defaultAgentQueueTaskRunSettings,
  type AgentQueueTaskRunSettingsDefaults,
} from "./queue/agentQueueRunSettingsDefaults";
import {
  workspaceAgentQueueBlockerLabel,
  workspaceAgentQueueNextRecommendedItem,
  workspaceAgentQueueTopBlockers,
} from "./workspaceAgentQueueActions";
import type {
  WorkspaceAgentQueueAutonomousActionResult,
  WorkspaceAgentQueueBridge,
} from "./workspaceAgentQueueBridge";

export type WorkspaceAgentQueueCommand =
  | { type: "analyzeQueue" }
  | { type: "explainFailure" }
  | {
      prompt: string;
      title: string;
      type: "createItem";
    }
  | {
      changedFieldLabels: string[];
      patch: QueueUpdateItemPatch;
      target: string;
      type: "updateItem";
    }
  | { type: "runAutonomousQueue" }
  | { type: "stopAutonomousQueueAfterCurrent" };

export type WorkspaceAgentQueueCommandResult = {
  body: string;
  handled: boolean;
};

type WorkspaceAgentQueueCommandHandlerOptions = {
  bridge?: WorkspaceAgentQueueBridge;
  currentWorkspaceRoot?: string | null;
};

const CREATE_PHRASES = [
  "create queue item",
  "add queue task",
  "create task",
  "\u0441\u043e\u0437\u0434\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443",
  "\u0434\u043e\u0431\u0430\u0432\u044c \u0437\u0430\u0434\u0430\u0447\u0443",
  "\u0434\u043e\u0431\u0430\u0432\u044c task",
];

const ANALYZE_PHRASES = [
  "analyze queue",
  "show queue",
  "what is in queue",
  "what should run next",
  "\u043f\u0440\u043e\u0430\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u0439 \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
  "\u0447\u0442\u043e \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
];

const FAILURE_EXPLANATION_PATTERNS = [
  /\bwhy\s+(?:it|this|that|the\s+(?:queue\s+)?task)\s+failed\b/i,
  /\bwhy\s+did\s+(?:it|this|that|the\s+(?:queue\s+)?task)\s+fail\b/i,
  /\bexplain\s+(?:this\s+)?failure\b/i,
  /\bwhat\s+failed\b/i,
  /\bwhy\s+failed\b/i,
  /\bwhy\s+(?:задача|task)\s+failed\b/i,
  /почему\s+упало/i,
  /почему\s+ошибка/i,
  /объясни\s+ошибку/i,
  /почему\s+задача\s+failed/i,
  /почему\s+task\s+failed/i,
];

const RUN_AUTONOMOUS_PHRASES = [
  "run autonomous queue",
  "start autonomous queue",
  "run queue",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u0430\u0432\u0442\u043e\u043d\u043e\u043c\u043d\u0443\u044e \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 autonomous",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
];

const STOP_AUTONOMOUS_PHRASES = [
  "stop autonomous queue",
  "stop after current task",
  "\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438 \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u043f\u043e\u0441\u043b\u0435 \u0442\u0435\u043a\u0443\u0449\u0435\u0439",
  "\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438 \u043f\u043e\u0441\u043b\u0435 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0437\u0430\u0434\u0430\u0447\u0438",
];

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
  "danger_full_access",
  "read_only",
  "workspace_write",
];

const APPROVAL_POLICIES: DirectWorkApprovalPolicy[] = [
  "never",
  "on_request",
  "untrusted",
];

export function parseWorkspaceAgentQueueCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  const visibleText = text.trim();

  if (!visibleText) {
    return null;
  }

  if (startsWithAnyPhrase(visibleText, ANALYZE_PHRASES)) {
    return { type: "analyzeQueue" };
  }

  if (isFailureExplanationIntent(visibleText)) {
    return { type: "explainFailure" };
  }

  if (startsWithAnyPhrase(visibleText, RUN_AUTONOMOUS_PHRASES)) {
    return { type: "runAutonomousQueue" };
  }

  if (startsWithAnyPhrase(visibleText, STOP_AUTONOMOUS_PHRASES)) {
    return { type: "stopAutonomousQueueAfterCurrent" };
  }

  const createBody = stripLeadingPhrase(visibleText, CREATE_PHRASES);
  if (createBody !== null) {
    const explicitPrompt = fencedPrompt(visibleText);
    const createPrompt = explicitPrompt
      ? {
          prompt: explicitPrompt,
          title:
            firstSentence(stripFenceBlocks(createBody)) ||
            "Workspace Agent task",
        }
      : structuredCreateQueueTaskPrompt(createBody);

    return {
      prompt: createPrompt.prompt,
      title: createPrompt.title,
      type: "createItem",
    };
  }

  return parseUpdateCommand(visibleText);
}

export async function runWorkspaceAgentQueueCommand(
  text: string,
  options: WorkspaceAgentQueueCommandHandlerOptions,
): Promise<WorkspaceAgentQueueCommandResult> {
  const command = parseWorkspaceAgentQueueCommand(text);

  if (!command) {
    return { body: "", handled: false };
  }

  if (!options.bridge) {
    return {
      body: "Queue command could not run: Agent Queue bridge is unavailable.",
      handled: true,
    };
  }

  switch (command.type) {
    case "analyzeQueue":
      return {
        body: await analyzeQueue(options.bridge),
        handled: true,
      };
    case "explainFailure":
      return {
        body: await explainQueueFailure(options.bridge),
        handled: true,
      };
    case "createItem":
      return {
        body: await createQueueItem(command, options),
        handled: true,
      };
    case "updateItem":
      return {
        body: await updateQueueItem(command, options.bridge),
        handled: true,
      };
    case "runAutonomousQueue":
      return {
        body: await runAutonomousQueue(options.bridge),
        handled: true,
      };
    case "stopAutonomousQueueAfterCurrent":
      return {
        body: await stopAutonomousQueueAfterCurrent(options.bridge),
        handled: true,
      };
  }
}

function parseUpdateCommand(
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

  applyTextField(patch, changedFieldLabels, "title", singleFieldBody(trimmedBody, "title"));
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
    labeledValue(trimmedBody, ["execution workspace", "task workspace", "workspace"]) ||
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
    labeledValue(trimmedBody, ["sandbox"]) || singleFieldBody(trimmedBody, "sandbox"),
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

async function analyzeQueue(bridge: WorkspaceAgentQueueBridge) {
  try {
    const result = await bridge.getSnapshot({ includeSelectedItem: true });
    const snapshot = result.snapshot ?? result.item;

    if (!result.ok || !snapshot) {
      return `Queue snapshot could not be loaded: ${
        result.error?.message ?? result.message
      }`;
    }

    return queueSummary(snapshot);
  } catch (error) {
    return `Queue snapshot could not be loaded: ${errorToMessage(error)}`;
  }
}

async function explainQueueFailure(bridge: WorkspaceAgentQueueBridge) {
  try {
    const result = await bridge.getSnapshot({ includeSelectedItem: true });
    const snapshot = result.snapshot ?? result.item;

    if (!result.ok || !snapshot) {
      return `Queue failure evidence could not be loaded: ${
        result.error?.message ?? result.message
      }`;
    }

    return queueFailureExplanation(snapshot);
  } catch (error) {
    return `Queue failure evidence could not be loaded: ${errorToMessage(error)}`;
  }
}

async function createQueueItem(
  command: Extract<WorkspaceAgentQueueCommand, { type: "createItem" }>,
  options: WorkspaceAgentQueueCommandHandlerOptions,
) {
  const runSettings = queueCreateRunSettings(options);
  const hasExecutionWorkspace = Boolean(runSettings.executionWorkspace);

  try {
    const result = await options.bridge?.createItem({
      approvalPolicy: runSettings.approvalPolicy,
      codexExecutable: runSettings.codexExecutable,
      executionPolicy: "manual",
      executionWorkspace: runSettings.executionWorkspace || undefined,
      priority: 0,
      prompt: command.prompt,
      queueTag: { name: "Default" },
      sandbox: runSettings.sandbox,
      status: hasExecutionWorkspace ? "queued" : "draft",
      title: command.title,
    });

    if (!result) {
      return "Queue item could not be created: Agent Queue bridge is unavailable.";
    }

    if (!result.ok || !result.item) {
      return `Queue item could not be created: ${
        result.error?.message ?? result.message
      }`;
    }

    return createdItemSummary(result.item);
  } catch (error) {
    return `Queue item could not be created: ${errorToMessage(error)}`;
  }
}

async function updateQueueItem(
  command: Extract<WorkspaceAgentQueueCommand, { type: "updateItem" }>,
  bridge: WorkspaceAgentQueueBridge,
) {
  if (!command.target.trim()) {
    return "Queue update needs a task id or title match.";
  }

  if (Object.keys(command.patch).length === 0) {
    return "Queue update needs at least one supported field change.";
  }

  let snapshot: QueueWidgetSnapshot | null = null;
  try {
    const snapshotResult = await bridge.getSnapshot();
    snapshot = snapshotResult.snapshot ?? snapshotResult.item ?? null;
    if (!snapshotResult.ok || !snapshot) {
      return `Queue update could not inspect Queue: ${
        snapshotResult.error?.message ?? snapshotResult.message
      }`;
    }
  } catch (error) {
    return `Queue update could not inspect Queue: ${errorToMessage(error)}`;
  }

  const match = findQueueUpdateTarget(snapshot.items, command.target);
  if (match.kind === "missing") {
    return `Queue update needs a specific task. No item matched "${command.target}".`;
  }

  if (match.kind === "ambiguous") {
    return `Queue update needs a specific task. Matching items: ${match.items
      .map((item) => `${item.id} (${item.title})`)
      .join(", ")}.`;
  }

  try {
    const result = await bridge.updateItem({
      itemId: match.item.id,
      patch: command.patch,
    });

    if (!result.ok || !result.item) {
      return `Queue item could not be updated: ${
        result.error?.message ?? result.message
      }`;
    }

    const changed = command.changedFieldLabels.length
      ? command.changedFieldLabels.join(", ")
      : Object.keys(command.patch).join(", ");
    return `Updated Queue item: ${result.item.id} - ${result.item.title}. ${
      changed ? `Changed: ${changed}.` : "No fields changed."
    }`;
  } catch (error) {
    return `Queue item could not be updated: ${errorToMessage(error)}`;
  }
}

async function runAutonomousQueue(bridge: WorkspaceAgentQueueBridge) {
  if (!bridge.runAutonomousQueue) {
    return "Autonomous Queue could not start: Queue autonomous controls are unavailable.";
  }

  try {
    return autonomousResultMessage(
      await bridge.runAutonomousQueue(),
      "Autonomous Queue started.",
      "Autonomous Queue could not start",
    );
  } catch (error) {
    return `Autonomous Queue could not start: ${errorToMessage(error)}`;
  }
}

async function stopAutonomousQueueAfterCurrent(
  bridge: WorkspaceAgentQueueBridge,
) {
  if (!bridge.stopAutonomousQueueAfterCurrent) {
    return "Autonomous Queue could not stop: Queue autonomous controls are unavailable.";
  }

  try {
    return autonomousResultMessage(
      await bridge.stopAutonomousQueueAfterCurrent(),
      "Autonomous Queue will stop after the current task.",
      "Autonomous Queue could not stop",
    );
  } catch (error) {
    return `Autonomous Queue could not stop: ${errorToMessage(error)}`;
  }
}

function queueSummary(snapshot: QueueWidgetSnapshot) {
  const counts = snapshot.itemCounts;
  const topQueued = snapshot.items
    .filter((item) => (item.status === "queued" || item.status === "ready") && item.blockers.length === 0)
    .slice(0, 3);
  const blockers = workspaceAgentQueueTopBlockers(snapshot, 3);
  const nextItem = workspaceAgentQueueNextRecommendedItem(snapshot);

  return [
    `Queue has ${counts.total.toString()} item${counts.total === 1 ? "" : "s"}: ${counts.queued.toString()} queued, ${counts.running.toString()} running, ${counts.blocked.toString()} blocked, ${counts.reportReady.toString()} report-ready, ${counts.awaitingCoordinatorReview.toString()} awaiting review, ${counts.finalized.toString()} finalized.`,
    `Top queued tasks: ${
      topQueued.length > 0
        ? topQueued.map((item) => `${item.id} - ${item.title}`).join("; ")
        : "none"
    }.`,
    `Blockers: ${
      blockers.length > 0
        ? blockers.map(workspaceAgentQueueBlockerLabel).join("; ")
        : "none obvious"
    }.`,
    `Recommendation: ${queueRecommendation(snapshot, nextItem)}.`,
  ].join(" ");
}

function queueFailureExplanation(snapshot: QueueWidgetSnapshot) {
  const item = failureExplanationTarget(snapshot);

  if (!item) {
    return [
      "No failure evidence is available for this item.",
      "Open/refresh the Queue report or select the failed item.",
    ].join(" ");
  }

  if (!hasFailureEvidence(item)) {
    return [
      `Queue item: ${item.id} - ${item.title}.`,
      "No failure evidence is available for this item.",
      "Open/refresh the Queue report or select the failed item.",
    ].join(" ");
  }

  const latestRun = item.runLinks[0] ?? null;
  const failedCommand = firstNonEmpty([
    item.reportSummary.failedCommand,
    latestRun?.directWorkRunId
      ? `Direct Work run ${latestRun.directWorkRunId}`
      : null,
  ]);
  const errorMessage = firstNonEmpty([
    item.reportSummary.errorMessage,
    item.blockers.find((blocker) => blocker.code === "validation_failed")
      ?.message,
    item.blockers[0]?.message,
  ]);
  const resultStatus = item.reportSummary.status;
  const evidenceStatus = item.evidenceSummary.status;
  const validationSummary = firstNonEmpty([
    item.reportSummary.validationSummary,
    item.validationStatus ? `Validation status: ${item.validationStatus}.` : null,
    item.evidenceSummary.validationStatus
      ? `Validation status: ${item.evidenceSummary.validationStatus}.`
      : null,
  ]);
  const finalSummary = firstNonEmpty([
    item.reportSummary.summary,
    latestRun
      ? `Latest run ${latestRun.directWorkRunId} is ${latestRun.status}.`
      : null,
  ]);

  return [
    `Queue item: ${item.id} - ${item.title}.`,
    `Execution status: ${item.executionStatus}.`,
    `Coordinator/review status: ${item.coordinatorStatus ?? "not reported"}.`,
    `Result/evidence status: report ${resultStatus}, evidence ${evidenceStatus}.`,
    `Failed command: ${failedCommand || "not available in Queue evidence"}.`,
    `Error message: ${errorMessage || "not available in Queue evidence"}.`,
    `Worker report / final response summary: ${
      finalSummary || "not available in Queue evidence"
    }.`,
    `Validation summary: ${
      validationSummary || "not available in Queue evidence"
    }.`,
    `Suggested next action: ${failureExplanationNextAction(item)}.`,
  ].join(" ");
}

function failureExplanationTarget(snapshot: QueueWidgetSnapshot) {
  if (snapshot.selectedItem && hasFailureEvidence(snapshot.selectedItem)) {
    return snapshot.selectedItem;
  }

  const failedItems = snapshot.items
    .filter(hasFailureEvidence)
    .sort((left, right) => timestampValue(right.updatedAt) - timestampValue(left.updatedAt));

  if (failedItems[0]) {
    return failedItems[0];
  }

  return snapshot.selectedItem;
}

function hasFailureEvidence(item: QueueWidgetItemSnapshot) {
  return (
    item.status === "failed" ||
    item.executionStatus === "failed" ||
    item.coordinatorStatus === "failed" ||
    item.validationStatus === "failed" ||
    item.evidenceSummary.validationStatus === "failed" ||
    item.reportSummary.status === "evidence_missing" ||
    Boolean(item.reportSummary.errorMessage) ||
    Boolean(item.reportSummary.failedCommand) ||
    item.blockers.some((blocker) => blocker.code === "validation_failed") ||
    item.runLinks.some((link) =>
      ["failed", "timed_out", "cancelled"].includes(link.status),
    )
  );
}

function failureExplanationNextAction(item: QueueWidgetItemSnapshot) {
  if (item.reportSummary.status === "evidence_missing") {
    return "refresh or open the Queue report so existing evidence can load; do not rerun validation unless explicitly requested";
  }

  if (item.reportSummary.errorMessage || item.reportSummary.failedCommand) {
    return "review the existing failed command/error in the Queue report, then decide whether to create a focused follow-up";
  }

  if (
    item.validationStatus === "failed" ||
    item.evidenceSummary.validationStatus === "failed"
  ) {
    return "inspect the existing validation evidence in the Queue report before deciding on a rerun";
  }

  return "open the Queue report for this item and review the linked evidence before taking action";
}

function queueRecommendation(
  snapshot: QueueWidgetSnapshot,
  nextItem: QueueWidgetItemSnapshot | undefined,
) {
  const counts = snapshot.itemCounts;

  if (counts.running > 0) {
    return "review active running work before starting more";
  }

  if (nextItem?.status === "queued" || nextItem?.status === "ready") {
    return `run or review ${nextItem.id} next`;
  }

  if (snapshot.blockers.length > 0 || counts.blocked > 0) {
    return "clear the top blocker before starting new work";
  }

  if (counts.total === 0) {
    return "create a focused Queue task";
  }

  if (nextItem?.status === "draft") {
    return `finish drafting ${nextItem.id}`;
  }

  return "no immediate Queue action";
}

function createdItemSummary(item: QueueWidgetItemSnapshot) {
  const executionWorkspace = item.executionWorkspace?.trim() ?? "";

  if (!executionWorkspace) {
    return "Created Queue item, but task workspace is missing.";
  }

  return [
    `Created Queue item: ${item.id} \u2014 ${item.title}. Status: ${item.status}.`,
    `Task workspace: ${executionWorkspace}`,
  ].join("\n");
}

function findQueueUpdateTarget(
  items: QueueWidgetItemSnapshot[],
  target: string,
):
  | { item: QueueWidgetItemSnapshot; kind: "matched" }
  | { items: QueueWidgetItemSnapshot[]; kind: "ambiguous" }
  | { kind: "missing" } {
  const normalizedTarget = target.trim().toLowerCase();
  const exactMatch = items.find(
    (item) => item.id.toLowerCase() === normalizedTarget,
  );

  if (exactMatch) {
    return { item: exactMatch, kind: "matched" };
  }

  const titleMatches = items.filter((item) =>
    item.title.toLowerCase().includes(normalizedTarget),
  );

  if (titleMatches.length === 1 && titleMatches[0]) {
    return { item: titleMatches[0], kind: "matched" };
  }

  if (titleMatches.length > 1) {
    return { items: titleMatches.slice(0, 5), kind: "ambiguous" };
  }

  return { kind: "missing" };
}

function autonomousResultMessage(
  result: WorkspaceAgentQueueAutonomousActionResult,
  successFallback: string,
  failurePrefix: string,
) {
  if (result.ok) {
    return result.message || successFallback;
  }

  return `${failurePrefix}: ${result.error?.message ?? result.message}`;
}

function startsWithAnyPhrase(text: string, phrases: string[]) {
  return phrases.some((phrase) => stripLeadingPhrase(text, [phrase]) !== null);
}

function isFailureExplanationIntent(text: string) {
  return FAILURE_EXPLANATION_PATTERNS.some((pattern) => pattern.test(text));
}

function stripLeadingPhrase(text: string, phrases: string[]) {
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

function fencedPrompt(text: string) {
  const match = text.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/);
  const prompt = match?.[1]?.trim();
  return prompt || null;
}

function stripFenceBlocks(text: string) {
  return text.replace(/```[\s\S]*?```/g, " ").trim();
}

function structuredCreateQueueTaskPrompt(rawIntent: string) {
  const normalizedIntent = normalizeCreateTaskIntent(rawIntent);

  if (isReadAgentsFirstLineIntent(normalizedIntent)) {
    return knownReadOnlyPrompt({
      command: "Get-Content .\\AGENTS.md -TotalCount 1",
      objective: "Read the first line of AGENTS.md.",
      reportItems: [
        "AGENTS.md first line",
        "confirmation that no files were changed",
      ],
      title: "Read AGENTS.md first line",
    });
  }

  if (isShowLocationIntent(normalizedIntent)) {
    return knownReadOnlyPrompt({
      command: "Get-Location",
      objective: "Show the current execution location.",
      reportItems: [
        "current location",
        "confirmation that no files were changed",
      ],
      title: "Show current location",
    });
  }

  if (isGitStatusIntent(normalizedIntent)) {
    return knownReadOnlyPrompt({
      command: "git status --short --branch",
      objective: "Show the current Git status.",
      reportItems: [
        "git status summary",
        "confirmation that no files were changed",
      ],
      title: "Show git status",
    });
  }

  const objective = rawIntent.trim() || "Create a Workspace Agent Queue task.";

  return {
    prompt: [
      "Mode:",
      "Queue executor task.",
      "",
      "Objective:",
      objective,
      "",
      "Do not edit files.",
      "Do not create files.",
      "Do not delete files.",
      "Do not commit, push, reset, clean, stash, or rollback.",
      "",
      "Report:",
      "",
      "* status",
      "* changes made, or confirmation that no files were changed",
      "* validation status only if explicitly requested or already present",
      "* risks or blockers",
    ].join("\n"),
    title: "Workspace Agent task",
  };
}

function knownReadOnlyPrompt({
  command,
  objective,
  reportItems,
  title,
}: {
  command: string;
  objective: string;
  reportItems: string[];
  title: string;
}) {
  return {
    prompt: [
      "Mode:",
      "Read-only command task.",
      "",
      "Objective:",
      objective,
      "",
      "Run only:",
      "",
      `* ${command}`,
      "",
      "Do not edit files.",
      "Do not create files.",
      "Do not delete files.",
      "Do not commit, push, reset, clean, stash, or rollback.",
      "",
      "Report:",
      "",
      ...reportItems.map((item) => `* ${item}`),
    ].join("\n"),
    title,
  };
}

function normalizeCreateTaskIntent(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function isReadAgentsFirstLineIntent(value: string) {
  return (
    /^read\s+agents\.md\s+first\s+line$/.test(value) ||
    /^read\s+first\s+line\s+(?:of\s+)?agents\.md$/.test(value)
  );
}

function isShowLocationIntent(value: string) {
  return /^(?:show|get)\s+(?:current\s+)?location$/.test(value);
}

function isGitStatusIntent(value: string) {
  return /^(?:(?:show|get)\s+)?git\s+status$/.test(value);
}

function firstSentence(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^(.+?)(?:[.!?](?:\s|$)|$)/);
  return compactTitle(match?.[1] ?? normalized);
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function timestampValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compactTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 96
    ? normalized
    : `${normalized.slice(0, 95).trim()}...`;
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

function applyTextField<K extends "title" | "description" | "prompt" | "executionWorkspace" | "codexExecutable">(
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

function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return allowed.some((entry) => entry === value);
}

function explicitWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "~") {
    return null;
  }

  return trimmed;
}

function queueCreateRunSettings(
  options: WorkspaceAgentQueueCommandHandlerOptions,
): AgentQueueTaskRunSettingsDefaults {
  const baseSettings = defaultAgentQueueTaskRunSettings();
  const bridgeSettings = options.bridge?.getRunSettingsDefaults?.() ?? null;
  const mergedSettings = {
    ...baseSettings,
    ...(bridgeSettings ?? {}),
  };
  const executionWorkspace =
    explicitWorkspaceRoot(bridgeSettings?.executionWorkspace) ??
    explicitWorkspaceRoot(options.currentWorkspaceRoot) ??
    "";
  const codexExecutable =
    mergedSettings.codexExecutable.trim() || baseSettings.codexExecutable;

  return {
    approvalPolicy: mergedSettings.approvalPolicy,
    codexExecutable,
    executionWorkspace,
    sandbox: mergedSettings.sandbox,
  };
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

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown Queue command error.";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
