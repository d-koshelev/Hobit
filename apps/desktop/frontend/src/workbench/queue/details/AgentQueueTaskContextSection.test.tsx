import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentQueueTask,
  AgentQueueTaskContextRef,
  KnowledgeDocument,
} from "../../../workspace/types";
import { attachContextToQueueTask } from "../../agentQueueKnowledgeContext";
import { AgentQueueTaskContextSection } from "./AgentQueueTaskContextSection";

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
});

describe("AgentQueueTaskContextSection", () => {
  it("renders durable Queue task context and visible prompt preview", () => {
    const selectedTask = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "Visible bounded body for the run prompt.",
          title: "Queue context docs",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );

    renderContextSection(selectedTask);

    expect(document.body.textContent).toContain(
      "Attached refs and bounded snapshots are visible on this Queue task",
    );
    expect(document.body.textContent).toContain("Durable bounded snapshots");
    expect(document.body.textContent).toContain("Prompt context preview");
    expect(document.body.textContent).toContain(
      "Only this visible, bounded Queue-owned task context is included.",
    );
    expect(document.body.textContent).toContain(
      "This prepared context is visible before execution and included only in the explicit run prompt.",
    );
    expect(document.body.textContent).toContain(
      "Visible bounded body for the run prompt.",
    );
    expect(document.body.textContent).toContain(
      "Prepared: 2026-06-04T10:00:00.000Z.",
    );
  });

  it("keeps empty state scoped to the Queue task", () => {
    renderContextSection(queueTask());

    expect(document.body.textContent).toContain(
      "No Knowledge or Skill refs are attached to this Queue task.",
    );
  });

  it("calls explicit detach for a selected context ref", () => {
    const selectedTask = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          title: "Queue context docs",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const onDetachContextRef = vi.fn();

    renderContextSection(selectedTask, onDetachContextRef);

    const removeButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Remove",
    );
    expect(removeButton).toBeTruthy();
    act(() => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onDetachContextRef).toHaveBeenCalledWith(
      selectedTask.context?.attachedKnowledgeRefs[0],
    );
  });
});

function renderContextSection(
  selectedTask: AgentQueueTask,
  onDetachContextRef?: (ref: AgentQueueTaskContextRef) => void,
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <AgentQueueTaskContextSection
        onDetachContextRef={onDetachContextRef}
        selectedTask={selectedTask}
      />,
    );
  });
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: "executor-1",
    createdAt: "2026-06-04T08:00:00.000Z",
    description: "Queue task description",
    executionPolicy: "manual",
    priority: 1,
    prompt: "Run the selected Queue task.",
    queueItemId: "queue-1",
    status: "ready",
    title: "Selected Queue task",
    updatedAt: "2026-06-04T08:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function knowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "Document content.",
    createdAt: "2026-06-04T08:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "doc-1",
    lifecycleStatus: "active",
    quickSummary: "Document summary.",
    scope: "workspace",
    sourceKind: "operator_authored",
    sourceLabel: "Workspace document",
    sourceRef: "",
    tags: "docs",
    title: "Knowledge document",
    updatedAt: "2026-06-04T09:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
