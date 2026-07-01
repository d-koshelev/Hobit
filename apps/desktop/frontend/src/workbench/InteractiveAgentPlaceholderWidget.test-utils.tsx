import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, vi } from "vitest";

import { InteractiveAgentPlaceholderWidget } from "./InteractiveAgentPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
  DirectWorkStreamEvent,
  AgentQueueReportActionCard,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
  Skill,
} from "../workspace/types";

export type CreateQueueTaskInput = Parameters<
  NonNullable<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]["onCreateAgentQueueTask"]
  >
>[0];

export type UpdateQueueTaskInput = Parameters<
  NonNullable<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]["onUpdateAgentQueueTask"]
  >
>[0];

export type CreateKnowledgeDocumentInput = Parameters<
  NonNullable<
    Parameters<
      typeof InteractiveAgentPlaceholderWidget
    >[0]["onCreateKnowledgeDocument"]
  >
>[0];

export type CreateSkillInput = Parameters<
  NonNullable<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]["onCreateSkill"]
  >
>[0];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

export { InteractiveAgentPlaceholderWidget };
export type {
  DirectWorkStreamEvent,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
} from "../workspace/types";
export function renderWidget(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  renderWidgetIntoRoot(overrides);
}

export async function rerenderWidget(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  await act(async () => {
    root?.render(widgetElement(overrides));
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function renderWidgetIntoRoot(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  act(() => {
    root?.render(widgetElement(overrides));
  });
}

export function renderWidgetTree(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

export function widgetElement(
  overrides: Partial<
    Parameters<typeof InteractiveAgentPlaceholderWidget>[0]
  > = {},
) {
  return (
    <InteractiveAgentPlaceholderWidget
      config={{}}
      definition={definition()}
      instance={instance()}
      title="Workspace Agent"
      {...overrides}
    />
  );
}

export async function sendMessage(message: string) {
  await setTextareaValue(message);

  await act(async () => {
    const sendButton = buttonWithText("Send");
    if (!sendButton) {
      throw new Error("Send button not found.");
    }
    sendButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function finalAnswerEnvelope(message: string) {
  return JSON.stringify({
    message,
    type: "hobit.final.answer",
  });
}

export async function setTextareaValue(message: string) {
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Message textarea not found.");
  }

  await act(async () => {
    setNativeValue(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function setNativeValue(field: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

export function setNativeInputValue(field: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

export function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

export function buttonsWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).filter(
    (button) => button.textContent === text,
  );
}

export function checkboxWithLabel(text: string) {
  return Array.from(document.querySelectorAll("label")).find((label) =>
    label.textContent?.includes(text),
  )?.querySelector<HTMLInputElement>('input[type="checkbox"]');
}

export async function setCheckboxChecked(label: string, checked: boolean) {
  const checkbox = checkboxWithLabel(label);
  if (!checkbox) {
    throw new Error(`Checkbox not found: ${label}`);
  }

  await act(async () => {
    if (checkbox.checked !== checked) {
      checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await Promise.resolve();
  });
}

export async function toggleDirectMode() {
  await act(async () => {
    await Promise.resolve();
  });
}

export function agentPicker() {
  return document.querySelector<HTMLSelectElement>(
    'select[aria-label="Workspace Agent picker"]',
  );
}

export function textInput() {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Working directory"]',
  );
  if (!input) {
    throw new Error("Working directory input not found.");
  }
  return input;
}

export async function setTextareaValueIn(selector: string, message: string) {
  const rootElement = document.querySelector(selector);
  const textarea = rootElement?.querySelector("textarea");
  if (!textarea) {
    throw new Error(`Message textarea not found in ${selector}.`);
  }

  await act(async () => {
    setNativeValue(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function clickButtonIn(selector: string, text: string) {
  const rootElement = document.querySelector(selector);
  const button = Array.from(rootElement?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent === text,
  );
  if (!button) {
    throw new Error(`Button not found in ${selector}: ${text}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function textInputValue() {
  return textInput().value;
}

export async function setTextInputValue(value: string) {
  const input = textInput();

  await act(async () => {
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function setSandboxValue(value: string) {
  if (!document.querySelector('[role="radiogroup"][aria-label="Codex sandbox"]')) {
    const settingsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle Codex settings"]',
    );
    if (!settingsButton) {
      throw new Error("Codex settings button not found.");
    }

    await act(async () => {
      settingsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  const label = sandboxLabel(value);
  const option = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '[role="radio"][aria-checked]',
    ),
  ).find((button) => button.textContent === label);
  if (!option) {
    throw new Error(`Codex sandbox option not found: ${label}`);
  }

  await act(async () => {
    option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function sandboxLabel(value: string) {
  if (value === "read_only") {
    return "Read only";
  }

  if (value === "workspace_write") {
    return "Workspace write";
  }

  if (value === "danger_full_access") {
    return "Full access";
  }

  return value;
}

export async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function textareaValue() {
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Message textarea not found.");
  }
  return textarea.value;
}

export function lastAssistantMessageText() {
  const assistantMessages = document.querySelectorAll(
    '[data-testid="interactive-agent-message-assistant"]',
  );
  const lastMessage = assistantMessages[assistantMessages.length - 1];
  return (
    lastMessage?.querySelector(".interactive-agent-message-body")
      ?.textContent ?? ""
  );
}

export function lastOperatorMessageText() {
  const operatorMessages = document.querySelectorAll(
    '[data-testid="interactive-agent-message-operator"]',
  );
  const lastMessage = operatorMessages[operatorMessages.length - 1];
  return lastMessage?.textContent ?? "";
}

export function providerResponse(
  overrides: Partial<GenerateCoordinatorProviderResponse> = {},
): GenerateCoordinatorProviderResponse {
  return {
    allowedTools: [],
    assistantText: "Provider answer.",
    noHiddenContextUsed: true,
    noMutationsPerformed: true,
    noToolsExecuted: true,
    proposalDrafts: [],
    providerError: null,
    providerKind: "mock-local",
    providerStatus: "completed",
    requestId: "provider-test-request",
    visibleContextMessageCount: 1,
    visibleProposalDraftCount: 0,
    ...overrides,
  };
}

export function definition(): WidgetDefinition {
  return {
    category: "core",
    componentKey: "interactive-agent",
    defaultConfig: {},
    defaultTitle: "Workspace Agent",
    description: "Workspace Agent",
    id: "interactive-agent",
    title: "Workspace Agent",
  };
}

export function instance(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    config: {},
    definitionId: "interactive-agent",
    id: "coordinator_widget",
    layout: {
      area: "main",
      height: 720,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Workspace Agent",
    visible: true,
    ...overrides,
  };
}

export function attachedContextRequest(overrides: {
  contextText: string;
  sourceLabel: string;
}) {
  return {
    contextText: overrides.contextText,
    id: 1,
    sourceLabel: overrides.sourceLabel,
    targetCoordinatorWidgetInstanceId: "coordinator_widget",
  };
}

export function queueReportCardRequest(card: AgentQueueReportActionCard) {
  return {
    card,
    id: 1,
    targetCoordinatorWidgetInstanceId: "coordinator_widget",
  };
}

export function queueReportCard(
  overrides: Partial<AgentQueueReportActionCard> = {},
): AgentQueueReportActionCard {
  return {
    cardId: "queue-report-card-source-1-report-1",
    changedFiles: ["src/report-card.tsx"],
    commitHash: "abc1234",
    createdAt: "2026-05-31T10:02:00.000Z",
    dependentItemIds: ["dependent-1"],
    errors: ["One validation failed."],
    followUpRecommendation: "Create a focused follow-up item.",
    linkedFollowUpItemIds: [],
    recommendedActions: [
      {
        actionId: "open_source_item",
        description: "Open the source Queue item.",
        enabled: true,
        label: "Open source item",
        type: "open_source_item",
      },
      {
        actionId: "mark_needs_changes",
        description: "Mark source item needs changes.",
        enabled: true,
        label: "Needs changes",
        type: "mark_needs_changes",
      },
      {
        actionId: "create_follow_up",
        description: "Create a queued follow-up.",
        enabled: true,
        label: "Create follow-up",
        type: "create_follow_up",
      },
      {
        actionId: "create_diff_review",
        description: "Create a queued Diff Review.",
        enabled: true,
        label: "Create diff review",
        type: "create_diff_review",
      },
      {
        actionId: "open_linked_diff_review",
        description: "Open linked Diff Review.",
        enabled: true,
        label: "Open linked diff review",
        type: "open_linked_diff_review",
      },
      {
        actionId: "mark_rollback_required",
        description: "Mark rollback required without execution.",
        enabled: true,
        label: "Rollback required",
        type: "mark_rollback_required",
      },
    ],
    reportKind: "worker_execution",
    reportStatus: "needs_follow_up",
    reportSummary: "Worker report summary.",
    rollbackRecommendation: "Review rollback need.",
    sourceItemDescription: "Source description",
    sourceItemId: "source-1",
    sourceItemPriority: 1,
    sourceItemPrompt: "Source prompt",
    sourceItemStatus: "queued",
    sourceItemTitle: "Source Queue item",
    sourceItemType: "implementation",
    sourceQueueTag: "Implementation",
    sourceQueueTagId: "implementation",
    sourceReportId: "report-1",
    sourceValidationStatus: "not_started",
    warnings: ["Diff review recommended."],
    ...overrides,
  };
}

export function directWorkEvent(
  overrides: Partial<DirectWorkStreamEvent>,
): DirectWorkStreamEvent {
  return {
    elapsedMs: 0,
    errorMessage: null,
    eventKind: "started",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    codexThreadId: null,
    runId: "run_1",
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "coordinator_widget",
    workbenchId: "workbench_1",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

export function knowledgeResult(
  overrides: Partial<KnowledgeDocumentSearchResult>,
): KnowledgeDocumentSearchResult {
  return {
    chunkId: "chunk_1",
    chunkIndex: 0,
    documentTitle: "Knowledge doc",
    knowledgeDocumentId: "doc_1",
    score: 10,
    snippet: "Knowledge snippet.",
    sourceLabel: "Workspace document",
    scope: "workspace",
    tags: "docs",
    ...overrides,
  };
}

export function skillFixture(
  overrides: Partial<Skill> & {
    reviewStatus?: Skill["reviewStatus"];
    title?: string;
  } = {},
): Skill {
  return {
    createdAt: "2026-05-24T00:00:00Z",
    prerequisites: "",
    reviewStatus: "draft",
    risks: "",
    skillId: "skill_1",
    steps: "",
    tags: "",
    title: "Skill",
    updatedAt: "2026-05-24T00:00:00Z",
    validation: "",
    whenToUse: "",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

export function knowledgeDocumentFixture(
  overrides: Partial<KnowledgeDocument> & {
    title?: string;
  } = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "",
    createdAt: "2026-05-24T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    lifecycleStatus: "active",
    quickSummary: "",
    scope: "workspace",
    sourceKind: "operator_authored",
    sourceLabel: "Workspace Agent conversation",
    sourceRef: "",
    tags: "",
    title: "Document",
    updatedAt: "2026-05-24T00:00:00Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

export function expectedCoordinatorCodexExecutable() {
  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? "codex.cmd"
    : "codex";
}
