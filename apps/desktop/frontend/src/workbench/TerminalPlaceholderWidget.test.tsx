import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type {
  CreateTerminalPtySessionRequest,
  TerminalPtySession,
  WriteTerminalPtySessionRequest,
} from "../workspace/types";

type CreatePtyInput = Omit<
  CreateTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;
type WritePtyInput = Omit<
  WriteTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

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

describe("TerminalPlaceholderWidget classic surface", () => {
  it("renders the compact terminal surface with settings collapsed by default", () => {
    renderWidget();

    expect(document.body.textContent).toContain("Terminal");
    expect(document.body.textContent).toContain("Not started");
    expect(document.body.textContent).toContain("Working directory");
    expect(document.body.textContent).toContain("Shell");
    expect(document.body.textContent).toContain(
      "Start a terminal session to run commands.",
    );
    expect(
      document.querySelector('[aria-label="Terminal PTY output"]'),
    ).not.toBeNull();
    expect(
      document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Type a command"]',
      ),
    ).not.toBeNull();
    expect(buttonWithText("Start")).not.toBeNull();

    expect(document.body.textContent).toContain("Terminal settings");
    expect(document.body.textContent).not.toContain("Shell executable");
    expect(document.body.textContent).not.toContain("Shell args");
    expect(document.body.textContent).not.toContain("Columns");
    expect(document.body.textContent).not.toContain("Rows");
    expect(document.body.textContent).not.toContain("Output cap bytes");
    expect(document.body.textContent).not.toContain(
      "Legacy one-shot command fallback",
    );
  });

  it("keeps PTY settings and legacy fallback accessible inside settings", async () => {
    renderWidget();

    await clickText("Terminal settings");

    expect(document.body.textContent).toContain("Shell executable");
    expect(document.body.textContent).toContain("Shell args");
    expect(document.body.textContent).toContain("Columns");
    expect(document.body.textContent).toContain("Rows");
    expect(document.body.textContent).toContain("Output cap bytes");
    expect(document.body.textContent).toContain(
      "Legacy one-shot command fallback",
    );

    await clickText("Legacy one-shot command fallback");

    expect(document.body.textContent).toContain("Legacy one-shot command");
    expect(document.body.textContent).toContain("Program");
    expect(document.body.textContent).toContain("Arguments");
    expect(buttonWithText("Run command")).not.toBeNull();
  });

  it("starts a PTY session without changing the create request shape", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: "Windows PowerShell\r\nPS C:\\repo> ",
        status: "running",
        workingDirectory: "C:\\repo",
      }),
    );

    renderWidget({ onCreateTerminalPtySession });

    await changeInput("C:\\path\\to\\workspace", "C:\\repo");
    await clickButton("Start");

    expect(onCreateTerminalPtySession).toHaveBeenCalledTimes(1);
    expect(onCreateTerminalPtySession.mock.calls[0][0]).toBe("terminal_widget");
    expect(onCreateTerminalPtySession.mock.calls[0][1]).toEqual({
      cols: 80,
      outputBufferCapBytes: 65536,
      rows: 24,
      shell: "powershell.exe",
      shellArgs: [],
      workingDirectory: "C:\\repo",
    });
    expect(document.body.textContent).toContain("Running");
    expect(document.body.textContent).toContain("Windows PowerShell");
    expect(buttonWithText("Stop")).not.toBeNull();
  });

  it("sends prompt input through the existing write callback shape", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "running", workingDirectory: "C:\\repo" }),
    );
    const onWriteTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: WritePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: "echo hello\r\nhello\r\n",
        status: "running",
        workingDirectory: "C:\\repo",
      }),
    );

    renderWidget({ onCreateTerminalPtySession, onWriteTerminalPtySession });

    await changeInput("C:\\path\\to\\workspace", "C:\\repo");
    await clickButton("Start");
    await changeTextarea("Type a command", "echo hello");
    await clickButton("Send");

    expect(onWriteTerminalPtySession).toHaveBeenCalledTimes(1);
    expect(onWriteTerminalPtySession.mock.calls[0][0]).toBe("terminal_widget");
    expect(onWriteTerminalPtySession.mock.calls[0][1]).toEqual({
      data: "echo hello\r\n",
      sessionId: "pty_1",
    });
    expect(document.body.textContent).toContain("hello");
  });
});

function renderWidget(
  overrides: Partial<Parameters<typeof TerminalPlaceholderWidget>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <TerminalPlaceholderWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        title="Terminal"
        {...overrides}
      />,
    );
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function clickText(text: string) {
  await act(async () => {
    const element = Array.from(
      document.querySelectorAll("summary, button"),
    ).find((candidate) => candidate.textContent === text);
    if (!element) {
      throw new Error(`Clickable text not found: ${text}`);
    }
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function changeInput(placeholder: string, value: string) {
  await act(async () => {
    const input = Array.from(document.querySelectorAll("input")).find(
      (candidate) => candidate.placeholder === placeholder,
    );
    if (!input) {
      throw new Error(`Input not found: ${placeholder}`);
    }
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function changeTextarea(placeholder: string, value: string) {
  await act(async () => {
    const textarea = Array.from(document.querySelectorAll("textarea")).find(
      (candidate) => candidate.placeholder === placeholder,
    );
    if (!textarea) {
      throw new Error(`Textarea not found: ${placeholder}`);
    }
    textarea.value = value;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function definition(): WidgetDefinition {
  return {
    category: "tool",
    componentKey: "terminal-placeholder",
    defaultConfig: {},
    defaultTitle: "Terminal",
    description: "Terminal",
    id: "terminal",
    title: "Terminal",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "terminal",
    id: "terminal_widget",
    layout: {
      area: "main",
      height: 560,
      mode: "docked",
      order: 1,
      width: 720,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Terminal",
    visible: true,
  };
}

function terminalSession({
  outputText = "",
  status = "running",
  workingDirectory = "C:\\repo",
}: {
  outputText?: string;
  status?: string;
  workingDirectory?: string;
} = {}): TerminalPtySession {
  return {
    endedAt: null,
    errorMessage: null,
    exitCode: null,
    output: {
      capBytes: 65536,
      chunks: outputText
        ? [
            {
              byteLen: outputText.length,
              sequence: 1,
              streamKind: "pty",
              text: outputText,
            },
          ]
        : [],
      droppedBytes: 0,
      totalBufferedBytes: outputText.length,
    },
    rows: 24,
    cols: 80,
    sessionId: "pty_1",
    shell: "powershell.exe",
    shellArgs: [],
    startedAt: "2026-05-27T00:00:00.000Z",
    status,
    workbenchId: "workbench_1",
    widgetInstanceId: "terminal_widget",
    workspaceId: "workspace_1",
    workingDirectory,
  };
}
