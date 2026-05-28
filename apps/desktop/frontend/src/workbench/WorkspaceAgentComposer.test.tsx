import { act, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceAgentComposer } from "./WorkspaceAgentComposer";
import {
  EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
  EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
} from "./workspaceAgentDirectWorkModel";

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

describe("WorkspaceAgentComposer", () => {
  it("renders the composer placeholder and chat send action", () => {
    renderComposer();

    expect(messageTextarea().placeholder).toBe(
      "Plan work, draft Queue tasks, review pasted results, or ask what to do next.",
    );
    expect(buttonWithText("Send")).toBeDefined();
    expect(document.body.textContent).toContain(
      "Send uses visible chat only. No tools run.",
    );
  });

  it("calls onSend from the chat composer", async () => {
    const onSend = vi.fn();
    renderComposer({ onSend });

    await setTextareaValue("Review this visible result.");
    await clickButton("Send");

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("calls onRunWithCodex from the direct-mode composer", async () => {
    const onRunWithCodex = vi.fn();
    renderComposer({ directModeEnabled: true, onRunWithCodex });

    await setTextareaValue("Run this with Codex.");
    await clickButton("Run with Codex");

    expect(onRunWithCodex).toHaveBeenCalledTimes(1);
  });

  it("disables Run with Codex when the composer is empty", () => {
    renderComposer({ directModeEnabled: true });

    expect(buttonWithText("Run with Codex")?.disabled).toBe(true);
  });

  it("keeps the message input before Direct Work controls", () => {
    renderComposer({ directModeEnabled: true });

    const textarea = messageTextarea();
    const directModePanel = document.querySelector(
      ".interactive-agent-direct-mode",
    );

    expect(directModePanel).not.toBeNull();
    expect(
      textarea.compareDocumentPosition(directModePanel as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders and removes visible attached context", async () => {
    const onRemoveVisibleContext = vi.fn();
    renderComposer({
      onRemoveVisibleContext,
      visibleAttachedContext: {
        contextText: "Run: run_safe_123456",
        sourceLabel: "Executor run detail",
      },
    });

    expect(document.body.textContent).toContain("Visible attached context");
    expect(document.body.textContent).toContain("Run: run_safe_123456");

    await clickButton("Remove");

    expect(onRemoveVisibleContext).toHaveBeenCalledTimes(1);
  });
});

type RenderComposerOptions = {
  directModeEnabled?: boolean;
  initialDraft?: string;
  onRemoveVisibleContext?: () => void;
  onRunWithCodex?: () => void;
  onSend?: () => void;
  visibleAttachedContext?: Parameters<
    typeof WorkspaceAgentComposer
  >[0]["visibleAttachedContext"];
};

function renderComposer(options: RenderComposerOptions = {}) {
  render(<ComposerHarness {...options} />);
}

function ComposerHarness({
  directModeEnabled = false,
  initialDraft = "",
  onRemoveVisibleContext = vi.fn(),
  onRunWithCodex = vi.fn(),
  onSend = vi.fn(),
  visibleAttachedContext = null,
}: RenderComposerOptions) {
  const [draft, setDraft] = useState(initialDraft);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canAct = draft.trim().length > 0;

  return (
    <WorkspaceAgentComposer
      canSend={canAct}
      directMode={
        directModeEnabled
          ? {
              activitySummary: EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY,
              canStartDirectWork: canAct,
              canStopDirectWork: false,
              directWorkDirectory: "~",
              error: null,
              finalResult: null,
              isStopPending: false,
              knowledgeLookup: EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP,
              logs: [],
              onDirectoryChange: vi.fn(),
              onResetThread: vi.fn(),
              onSelectWorkspaceDirectory: vi.fn(async () => null),
              onStopDirectWork: vi.fn(),
              runId: null,
              status: "idle",
              threadId: null,
              threadNotice: null,
              warning: null,
            }
          : null
      }
      draft={draft}
      isProviderPending={false}
      onMessageChange={setDraft}
      onRemoveVisibleContext={onRemoveVisibleContext}
      onRunWithCodex={onRunWithCodex}
      onSend={onSend}
      textareaRef={textareaRef}
      visibleAttachedContext={visibleAttachedContext}
    />
  );
}

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}

async function setTextareaValue(message: string) {
  const textarea = messageTextarea();

  await act(async () => {
    setNativeValue(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNativeValue(field: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

async function clickButton(text: string) {
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

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function messageTextarea() {
  const textarea = document.querySelector("textarea");
  if (!textarea) {
    throw new Error("Message textarea not found.");
  }
  return textarea;
}
