import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, vi } from "vitest";

import type { KnowledgeDocument, Skill } from "../workspace/types";
import { SkillLibraryWidget } from "./SkillLibraryWidget";
import { WidgetHost } from "./WidgetHost";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { WorkbenchWidgetInstanceActions } from "./useWorkbenchWidgetActions";
import {
  WidgetRuntimeContextProvider,
  type WidgetRuntimeContextValue,
} from "./widgetRuntimeContext";

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

export function renderWidget(
  overrides: Partial<Parameters<typeof SkillLibraryWidget>[0]> = {},
  runtime?: WidgetRuntimeContextValue,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    const widget = (
      <SkillLibraryWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        onCreateSkill={vi.fn(async (request) => skillFixture(request))}
        onDeleteSkill={vi.fn(async () => true)}
        onGetSkill={vi.fn(async () => null)}
        onListSkills={vi.fn(async () => [])}
        onUpdateSkill={vi.fn(async (request) => skillFixture(request))}
        onCreateKnowledgeDocument={vi.fn(async (request) =>
          knowledgeDocumentFixture(request),
        )}
        onDeleteKnowledgeDocument={vi.fn(async () => true)}
        onGetKnowledgeDocument={vi.fn(async () => null)}
        onListKnowledgeDocuments={vi.fn(async () => [])}
        onUpdateKnowledgeDocument={vi.fn(async (request) =>
          knowledgeDocumentFixture(request),
        )}
        title="Knowledge / Skills"
        {...overrides}
      />
    );

    root?.render(
      runtime ? (
        <WidgetRuntimeContextProvider runtime={runtime}>
          {widget}
        </WidgetRuntimeContextProvider>
      ) : (
        widget
      ),
    );
  });
}

export function renderWidgetThroughHost({
  actions: actionOverrides = {},
}: {
  actions?: Partial<WorkbenchWidgetInstanceActions>;
} = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  const actions = widgetActions(actionOverrides);

  act(() => {
    root?.render(
      <WidgetHost
        agentActivityEvents={[]}
        agentExecutorRunOpenRequest={null}
        agentExecutorSlots={[]}
        agentQueueItemOpenRequest={null}
        coordinatorAttachedContextRequest={null}
        directWorkGitReview={{
          request: null,
          requestReview: vi.fn(),
          status: null,
          updateStatus: vi.fn(),
        }}
        directWorkRunHandoff={{
          handoffs: {},
          queueTaskAutoRefreshRequest: null,
          recordFinalState: vi.fn(),
          recordHandoff: vi.fn(),
        }}
        hasGitWidget={false}
        instance={instance()}
        layoutMode="locked"
        onDockBack={vi.fn()}
        onOpenAgentExecutorRun={vi.fn()}
        onPopOut={vi.fn()}
        onPublishAgentActivityEvents={vi.fn()}
        onStartDockedDrag={vi.fn()}
        onStartPopoutDrag={vi.fn()}
        presentationMode="docked"
        queueReportActionCardRequest={null}
        queueTaskStatusCardRequest={null}
        widgetActions={actions}
        workspaceId="workspace_1"
        workspaceQueueApi={
          ({
            controller: {
              knowledgeContext: {
                onAttachSelected: vi.fn(),
              },
            },
            createItem: vi.fn(),
            getSnapshot: vi.fn(),
            queueId: "workspace:workspace_1:agent-queue",
            queueExecutorSlots: [],
            updateItem: vi.fn(),
          } as unknown) as Parameters<typeof WidgetHost>[0]["workspaceQueueApi"]
        }
      />,
    );
  });

  return { actions };
}

export async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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

export async function clickEnabledButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        !isHidden(candidate) &&
        !candidate.disabled &&
        candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Enabled button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

export async function clickCatalogView(text: string) {
  await act(async () => {
    const group = Array.from(document.querySelectorAll("[aria-label]")).find(
      (candidate) =>
        !isHidden(candidate) &&
        candidate.getAttribute("aria-label") === "Knowledge catalog views",
    );
    const button = Array.from(group?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Catalog view not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function buttonWithText(text: string) {
  if (text === "Logs") {
    const logsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Widget logs"]',
    );
    if (logsButton) {
      return logsButton;
    }
  }

  return Array.from(document.querySelectorAll("button")).find(
    (candidate) => !isHidden(candidate) && candidate.textContent === text,
  );
}

export async function changeInput(selector: string, value: string) {
  const input = Array.from(
    document.querySelectorAll<HTMLInputElement>(selector),
  ).find((candidate) => !isHidden(candidate));
  if (!input) {
    throw new Error(`Input not found: ${selector}`);
  }

  await act(async () => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function changeTextarea(index: number, value: string) {
  const textarea = Array.from(document.querySelectorAll("textarea")).filter(
    (candidate) => !isHidden(candidate),
  )[index];
  if (!textarea) {
    throw new Error(`Textarea not found: ${index}`);
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function changeTextareaByLabel(labelText: string, value: string) {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) =>
      !isHidden(candidate) && candidate.textContent?.includes(labelText),
  );
  const textarea = label?.querySelector("textarea");
  if (!textarea) {
    throw new Error(`Textarea not found: ${labelText}`);
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function changeSelect(value: string) {
  const select = Array.from(document.querySelectorAll("select")).find(
    (candidate) => !isHidden(candidate),
  );
  if (!select) {
    throw new Error("Review status select not found.");
  }

  await act(async () => {
    setNativeValue(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function changeSelectByLabel(labelText: string, value: string) {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) =>
      !isHidden(candidate) && candidate.textContent?.includes(labelText),
  );
  const select = label?.querySelector("select");
  if (!select) {
    throw new Error(`Select not found: ${labelText}`);
  }

  await act(async () => {
    setNativeValue(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function changeCheckbox(labelText: string, checked: boolean) {
  const labels = Array.from(document.querySelectorAll("label")).filter(
    (candidate) =>
      !isHidden(candidate) && candidate.textContent?.includes(labelText),
  );
  const checkbox = labels
    .flatMap((label) => Array.from(label.querySelectorAll("input")))
    .find((input) => input.type === "checkbox");
  if (!checkbox) {
    throw new Error(`Checkbox not found: ${labelText}`);
  }

  await act(async () => {
    if (checkbox.checked !== checked) {
      checkbox.click();
    }
  });
}

export async function chooseImportFile(fileName: string, content: string) {
  const input = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[aria-label="Choose Knowledge import file"]',
    ),
  ).find((candidate) => !isHidden(candidate));
  if (!input) {
    throw new Error("Knowledge import file input not found.");
  }

  const file = new File([content], fileName, {
    type: fileName.endsWith(".txt") ? "text/plain" : "text/markdown",
  });

  await act(async () => {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setNativeValue(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    "value",
  );
  descriptor?.set?.call(field, value);
}

export function isHidden(element: Element) {
  return Boolean(element.closest("[hidden]"));
}

export function visibleListRowsText() {
  return Array.from(document.querySelectorAll(".skill-list-row"))
    .filter((candidate) => !isHidden(candidate))
    .map((candidate) => candidate.textContent ?? "")
    .join("\n");
}

export async function clickListRow(text: string) {
  await act(async () => {
    const row = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".skill-list-row"),
    ).find(
      (candidate) =>
        !isHidden(candidate) && candidate.textContent?.includes(text),
    );
    if (!row) {
      throw new Error(`List row not found: ${text}`);
    }
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
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
    sourceLabel: "Workspace document",
    sourceRef: "",
    tags: "",
    title: "Document",
    updatedAt: "2026-05-24T00:00:00Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function definition(): WidgetDefinition {
  return {
    category: "knowledge",
    componentKey: "skill-library-widget",
    defaultConfig: {},
    defaultTitle: "Knowledge / Skills",
    description: "Knowledge / Skills",
    id: "skill-library",
    title: "Knowledge / Skills",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "skill-library",
    id: "skill_widget",
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
    title: "Knowledge / Skills",
    visible: true,
  };
}

function widgetActions(
  overrides: Partial<WorkbenchWidgetInstanceActions>,
): WorkbenchWidgetInstanceActions {
  return {
    createAgentQueueTask: vi.fn(),
    createKnowledgeDocument: vi.fn(async (request) =>
      knowledgeDocumentFixture(request),
    ),
    createSkill: vi.fn(async (request) => skillFixture(request)),
    deleteKnowledgeDocument: vi.fn(async () => true),
    deleteSkill: vi.fn(async () => true),
    getKnowledgeDocument: vi.fn(async () => null),
    getSkill: vi.fn(async () => null),
    listKnowledgeDocuments: vi.fn(async () => []),
    listKnowledgeDraftReviews: vi.fn(async () => []),
    listSkills: vi.fn(async () => []),
    listWidgetLogs: vi.fn(async () => []),
    logRefreshTokens: {
      skill_widget: 2,
    },
    readKnowledgeDocumentImportFile: vi.fn(),
    recordKnowledgeDraftReview: vi.fn(),
    removeWidgetInstance: vi.fn(),
    updateKnowledgeDocument: vi.fn(async (request) =>
      knowledgeDocumentFixture(request),
    ),
    updateSkill: vi.fn(async (request) => skillFixture(request)),
    updateWidgetLayout: vi.fn(),
    updateWidgetState: vi.fn(),
    ...overrides,
  } as unknown as WorkbenchWidgetInstanceActions;
}
