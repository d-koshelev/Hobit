import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentRunRequest,
  CodexAgentRuntimeAdapter,
  CodexAgentRuntimeLaunchOptions,
  CodexAgentRuntimeRunHandle,
} from "../../agentRuntime";
import { createCodexProviderCapabilities } from "../../agentRuntime";
import { WorkspaceAgentV2Widget } from "./WorkspaceAgentV2Widget";

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

describe("WorkspaceAgentV2Widget scaffold", () => {
  it("renders the Workspace Agent v2 shell with Direct Run preflight", async () => {
    await render(
      <WorkspaceAgentV2Widget
        directRunSupported
        initialPrompt="Review this block."
        workingDirectory="C:/repo"
      />,
    );

    expect(headingWithText("Workspace Agent v2")).not.toBeNull();
    expect(document.body.textContent).toContain("Experimental");
    expect(document.body.textContent).toContain("Not connected");
    expect(document.body.textContent).toContain("Review only");
    expect(document.body.textContent).toContain("Transcript");
    expect(document.body.textContent).toContain("Activity");
    expect(document.body.textContent).toContain("Direct Run");
    expect(document.body.textContent).toContain("Queue Run");
    expect(document.body.textContent).toContain("Direct Run preflight");
    expect(document.body.textContent).toContain("Provider");
    expect(document.body.textContent).toContain("Codex");
    expect(document.body.textContent).toContain("Working directory");
    expect(document.body.textContent).toContain("C:/repo");
    expect(document.body.textContent).toContain("No Hobit tools allowed");
    expect(
      regionByRoleAndName("toolbar", "Workspace Agent v2 provider and mode row"),
    ).not.toBeNull();
    expect(
      regionByRoleAndName("region", "Workspace Agent v2 transcript")?.textContent,
    ).toContain("No hidden context is read.");
    expect(
      regionByRoleAndName("complementary", "Workspace Agent v2 activity pane")
        ?.textContent,
    ).toContain("No run activity");
    expect(
      regionByRoleAndName("region", "Workspace Agent v2 composer")?.textContent,
    ).toContain("New thread");
  });

  it("disables Direct Run for an empty prompt", async () => {
    await render(<WorkspaceAgentV2Widget />);

    expect(buttonWithText("Send")).toBeNull();
    expect(buttonWithText("Create Queue task")).toBeNull();
    expect(buttonWithText("Direct Run")?.disabled).toBe(true);
    expect(buttonWithText("Direct Run")?.title).toBe(
      "Enter a prompt before starting Direct Run.",
    );
    expect(buttonWithText("Queue Run")?.disabled).toBe(true);
    expect(inputByLabel("Workspace Agent v2 prompt")?.disabled).toBe(false);
  });

  it("does not invoke run callbacks on render", async () => {
    const onRunRequest = vi.fn();
    const onQueueTaskCreate = vi.fn();

    await render(
      <WorkspaceAgentV2Widget
        onQueueTaskCreate={onQueueTaskCreate}
        onRunRequest={onRunRequest}
      />,
    );

    expect(onRunRequest).not.toHaveBeenCalled();
    expect(onQueueTaskCreate).not.toHaveBeenCalled();
  });

  it("clicking Direct Run calls the controller provider once", async () => {
    const adapter = adapterFixture();
    const onRunRequest = vi.fn();

    await render(
      <WorkspaceAgentV2Widget
        adapter={adapter}
        initialPrompt="Run visible V2 prompt."
        onRunRequest={onRunRequest}
        workingDirectory="C:/repo"
      />,
    );

    await click(buttonWithText("Direct Run"));

    expect(onRunRequest).toHaveBeenCalledTimes(1);
    expect(adapter.startRun).toHaveBeenCalledTimes(1);
    const [request, launchOptions] = adapter.startRun.mock.calls[0] as [
      AgentRunRequest,
      CodexAgentRuntimeLaunchOptions,
    ];
    expect(request.prompt).toBe("Run visible V2 prompt.");
    expect(launchOptions.executionWorkspace).toBe("C:/repo");
    expect(document.body.textContent).toContain("Run visible V2 prompt.");
    expect(document.body.textContent).toContain("Visible context materialized");
  });

  it("Queue Run remains visible but does not create a task", async () => {
    const onQueueTaskCreate = vi.fn();

    await render(
      <WorkspaceAgentV2Widget
        directRunSupported
        initialPrompt="Queue this later."
        onQueueTaskCreate={onQueueTaskCreate}
        workingDirectory="C:/repo"
      />,
    );

    expect(buttonWithText("Queue Run")).not.toBeNull();
    expect(buttonWithText("Queue Run")?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Queue Run is not implemented in this Workspace Agent v2 block; no Queue task will be created.",
    );

    await click(buttonWithText("Queue Run"));

    expect(onQueueTaskCreate).not.toHaveBeenCalled();
  });

  it("running state disables duplicate Direct Run starts", async () => {
    const adapter = adapterFixture({
      startRun: vi.fn(
        async (): Promise<CodexAgentRuntimeRunHandle> => ({
          runId: "run-running",
          stopListening: vi.fn(),
          warnings: [],
        }),
      ),
    });

    await render(
      <WorkspaceAgentV2Widget
        adapter={adapter}
        initialPrompt="Run once."
        workingDirectory="C:/repo"
      />,
    );

    await click(buttonWithText("Direct Run"));

    expect(buttonWithText("Direct Run running")?.disabled).toBe(true);
    await click(buttonWithText("Direct Run running"));

    expect(adapter.startRun).toHaveBeenCalledTimes(1);
  });

  it("renders provider errors visibly", async () => {
    const adapter = adapterFixture({
      startRun: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    });

    await render(
      <WorkspaceAgentV2Widget
        adapter={adapter}
        initialPrompt="Fail visibly."
        workingDirectory="C:/repo"
      />,
    );

    await click(buttonWithText("Direct Run"));

    expect(document.body.textContent).toContain("provider unavailable");
    expect(document.body.textContent).toContain("Direct Run result");
    expect(document.body.textContent).toContain("Failed");
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

function headingWithText(text: string): HTMLHeadingElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLHeadingElement>("h1,h2,h3")).find(
      (heading) => heading.textContent === text,
    ) ?? null
  );
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function inputByLabel(label: string): HTMLTextAreaElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea")).find(
      (input) => input.getAttribute("aria-label") === label,
    ) ?? null
  );
}

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  if (element instanceof HTMLButtonElement && element.disabled) {
    return;
  }
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function regionByRoleAndName(role: string, name: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(`[role='${role}']`)).find(
      (element) => element.getAttribute("aria-label") === name,
    ) ?? null
  );
}

function adapterFixture({
  startRun,
}: {
  readonly startRun?: CodexAgentRuntimeAdapter["startRun"];
} = {}): CodexAgentRuntimeAdapter & {
  startRun: ReturnType<typeof vi.fn>;
} {
  return {
    capabilities: createCodexProviderCapabilities({ supportsCancellation: true }),
    cancelRun: vi.fn(async () => ({ supported: true, warnings: [] })),
    startRun: vi.fn(
      startRun ??
        (async (): Promise<CodexAgentRuntimeRunHandle> => ({
          runId: "run-1",
          stopListening: vi.fn(),
          warnings: [],
        })),
    ),
  };
}
