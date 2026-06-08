import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentContextSnapshot,
  AgentRunRequest,
  AgentRunResult,
  CodexAgentRuntimeAdapter,
  CodexAgentRuntimeLaunchOptions,
  CodexAgentRuntimeRunHandle,
} from "../../agentRuntime";
import {
  CODEX_AGENT_PROVIDER_ID,
  createCodexProviderCapabilities,
} from "../../agentRuntime";
import { useWorkspaceAgentV2DirectRun } from "./useWorkspaceAgentV2DirectRun";

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

describe("useWorkspaceAgentV2DirectRun", () => {
  it("render does not call the provider", async () => {
    const adapter = adapterFixture();

    await render(<DirectRunHarness adapter={adapter} />);

    expect(adapter.startRun).not.toHaveBeenCalled();
    expect(textByTestId("status")).toBe("idle");
  });

  it("explicit start calls the Codex provider once with prompt and visible context", async () => {
    const adapter = adapterFixture();

    await render(
      <DirectRunHarness
        adapter={adapter}
        prompt="Review the visible V2 state."
        visibleContextSnapshot={visibleContextSnapshot}
        workingDirectory="C:/repo"
      />,
    );

    await click(buttonWithText("Start direct run"));

    expect(adapter.startRun).toHaveBeenCalledTimes(1);
    const [request, launchOptions] = adapter.startRun.mock.calls[0] as [
      AgentRunRequest,
      CodexAgentRuntimeLaunchOptions,
    ];
    expect(request).toMatchObject({
      contextSnapshot: visibleContextSnapshot,
      mode: "direct",
      prompt: "Review the visible V2 state.",
      providerId: CODEX_AGENT_PROVIDER_ID,
      toolPolicy: {
        allowedTools: [],
        mode: "none",
      },
    });
    expect(launchOptions).toMatchObject({
      approvalPolicy: "never",
      codexExecutable: "codex",
      executionWorkspace: "C:/repo",
      sandbox: "workspace_write",
      widgetInstanceId: "workspace-agent-v2-widget-1",
    });
    expect(textByTestId("status")).toBe("running");
  });

  it("running state blocks duplicate start", async () => {
    const startRun = vi.fn(
      async (): Promise<CodexAgentRuntimeRunHandle> => ({
        runId: "run-duplicate",
        stopListening: vi.fn(),
        warnings: [],
      }),
    );
    const adapter = adapterFixture({ startRun });

    await render(<DirectRunHarness adapter={adapter} />);

    await act(async () => {
      buttonWithText("Start direct run")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      buttonWithText("Start direct run")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(adapter.startRun).toHaveBeenCalledTimes(1);
    expect(textByTestId("warnings")).toContain(
      "Direct Run is already running; duplicate start was ignored.",
    );
  });

  it("provider failure maps to failed state", async () => {
    const adapter = adapterFixture({
      startRun: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    });

    await render(<DirectRunHarness adapter={adapter} />);
    await click(buttonWithText("Start direct run"));

    expect(textByTestId("status")).toBe("failed");
    expect(textByTestId("error")).toBe("provider unavailable");
    expect(textByTestId("transcript")).toContain("provider unavailable");
  });

  it("completed result appears once", async () => {
    const startRun = vi.fn(
      async (
        request: AgentRunRequest,
        _options: CodexAgentRuntimeLaunchOptions,
        _onEvent: unknown,
        _signal: unknown,
        onResult?: (result: AgentRunResult) => void,
      ): Promise<CodexAgentRuntimeRunHandle> => {
        const result = completedResult(request, "run-complete");
        onResult?.(result);
        onResult?.(result);
        return {
          runId: "run-complete",
          stopListening: vi.fn(),
          warnings: [],
        };
      },
    );
    const adapter = adapterFixture({ startRun });

    await render(<DirectRunHarness adapter={adapter} />);
    await click(buttonWithText("Start direct run"));

    expect(textByTestId("status")).toBe("completed");
    expect(textByTestId("transcript-count")).toBe("2");
    expect(textByTestId("transcript")).toContain("Run from explicit button.");
    expect(textByTestId("transcript")).toContain("Completed once.");
  });

  it("cancellation unsupported adds an honest warning without calling cancel", async () => {
    const cancelRun = vi.fn();
    const adapter = adapterFixture({
      cancelRun,
      supportsCancellation: false,
    });

    await render(<DirectRunHarness adapter={adapter} />);
    await click(buttonWithText("Start direct run"));
    await click(buttonWithText("Cancel direct run"));

    expect(cancelRun).not.toHaveBeenCalled();
    expect(textByTestId("warnings")).toContain(
      "Cancellation is unavailable for this Codex adapter instance.",
    );
  });
});

function DirectRunHarness({
  adapter,
  prompt = "Run from explicit button.",
  visibleContextSnapshot,
  workingDirectory = "C:/repo",
}: {
  readonly adapter: CodexAgentRuntimeAdapter;
  readonly prompt?: string;
  readonly visibleContextSnapshot?: AgentContextSnapshot;
  readonly workingDirectory?: string | null;
}) {
  const controller = useWorkspaceAgentV2DirectRun({
    adapter,
    visibleContextSnapshot,
    widgetInstanceId: "workspace-agent-v2-widget-1",
    workingDirectory,
    workspaceId: "workspace-1",
  });

  return (
    <section>
      <button onClick={() => void controller.startDirectRun(prompt)} type="button">
        Start direct run
      </button>
      <button onClick={() => void controller.cancelDirectRun()} type="button">
        Cancel direct run
      </button>
      <output data-testid="status">{controller.status}</output>
      <output data-testid="error">{controller.errorMessage}</output>
      <output data-testid="warnings">{controller.warnings.join("\n")}</output>
      <output data-testid="transcript-count">
        {controller.transcriptMessages.length}
      </output>
      <output data-testid="transcript">
        {controller.transcriptMessages.map((message) => message.body).join("\n")}
      </output>
    </section>
  );
}

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
  });
}

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === text,
    ) ?? null
  );
}

function textByTestId(testId: string) {
  return document.querySelector(`[data-testid='${testId}']`)?.textContent ?? "";
}

function adapterFixture({
  cancelRun,
  startRun,
  supportsCancellation = true,
}: {
  readonly cancelRun?: CodexAgentRuntimeAdapter["cancelRun"];
  readonly startRun?: CodexAgentRuntimeAdapter["startRun"];
  readonly supportsCancellation?: boolean;
} = {}): CodexAgentRuntimeAdapter & {
  cancelRun: ReturnType<typeof vi.fn>;
  startRun: ReturnType<typeof vi.fn>;
} {
  return {
    capabilities: createCodexProviderCapabilities({ supportsCancellation }),
    cancelRun: vi.fn(
      cancelRun ??
        (async () => ({
          supported: supportsCancellation,
          warnings: supportsCancellation
            ? []
            : ["Cancellation is unavailable for this Codex adapter instance."],
        })),
    ),
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

function completedResult(
  request: AgentRunRequest,
  runId: string,
): AgentRunResult {
  return {
    assistantText: "Completed once.",
    fileChanges: [],
    lifecycle: "completed",
    metadata: {
      durationMs: 10,
      lifecycle: "completed",
      mode: "direct",
      providerId: CODEX_AGENT_PROVIDER_ID,
      runId,
      tokenUsage: null,
      workspaceId: request.workspaceId,
    },
    runId,
    validationSuggestions: [],
  };
}

const visibleContextSnapshot: AgentContextSnapshot = {
  contextRefs: [
    {
      id: "context-ref-1",
      kind: "visible-chat",
      label: "Visible chat",
      scope: "current-session",
    },
  ],
  createdAtMs: 1_000,
  id: "snapshot-1",
  summary: "Visible test context.",
  tokenEstimate: 12,
  visibleTextPreview: "Visible only.",
};
