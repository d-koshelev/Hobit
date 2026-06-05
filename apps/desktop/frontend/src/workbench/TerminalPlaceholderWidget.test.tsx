import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const xtermMockState = vi.hoisted(() => ({
  fitAddons: [] as Array<{ dispose: ReturnType<typeof vi.fn>; fit: ReturnType<typeof vi.fn> }>,
  terminals: [] as Array<{
    bufferText: string;
    cols: number;
    dispose: ReturnType<typeof vi.fn>;
    disposed: boolean;
    emitData: (data: string) => void;
    focus: ReturnType<typeof vi.fn>;
    getSelection: ReturnType<typeof vi.fn>;
    loadAddon: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    rows: number;
    selectionText: string;
    write: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@xterm/xterm", () => {
  class Terminal {
    bufferText = "";
    cols = 80;
    rows = 24;
    selectionText = "";
    disposed = false;
    private dataHandler: ((data: string) => void) | null = null;

    constructor() {
      xtermMockState.terminals.push(this);
    }

    get buffer() {
      const lines = this.bufferText.split(/\r?\n/);
      return {
        active: {
          getLine: (index: number) => {
            const line = lines[index];
            return line === undefined
              ? undefined
              : { translateToString: () => line };
          },
          length: lines.length,
        },
      };
    }

    loadAddon = vi.fn();

    open = vi.fn((container: HTMLElement) => {
      container.setAttribute("data-xterm-open", "true");
    });

    onData(handler: (data: string) => void) {
      this.dataHandler = handler;
      return { dispose: vi.fn() };
    }

    write = vi.fn((data: string) => {
      this.bufferText += data;
    });

    clear = vi.fn(() => {
      this.bufferText = "";
    });

    focus = vi.fn();

    getSelection = vi.fn(() => this.selectionText);

    dispose = vi.fn(() => {
      this.disposed = true;
    });

    emitData(data: string) {
      this.dataHandler?.(data);
    }
  }

  return { Terminal };
});

vi.mock("@xterm/addon-fit", () => {
  class FitAddon {
    dispose = vi.fn();
    fit = vi.fn();

    constructor() {
      xtermMockState.fitAddons.push(this);
    }
  }

  return { FitAddon };
});

import { TerminalPlaceholderWidget } from "./TerminalPlaceholderWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import { resolveTerminalWorkingDirectoryWithHome } from "../workspace/types";
import type {
  CreateTerminalPtySessionRequest,
  ResizeTerminalPtySessionRequest,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  WriteTerminalPtySessionRequest,
} from "../workspace/types";

type CreatePtyInput = Omit<
  CreateTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;
type ResizePtyInput = Omit<
  ResizeTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;
type WritePtyInput = Omit<
  WriteTerminalPtySessionRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;
type PtyActionInput = Omit<
  TerminalPtySessionActionRequest,
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
  xtermMockState.fitAddons.length = 0;
  xtermMockState.terminals.length = 0;
  vi.restoreAllMocks();
});

describe("TerminalPlaceholderWidget xterm surface", () => {
  it("renders the xterm terminal surface with settings collapsed by default", () => {
    renderWidget();

    expect(document.body.textContent).toContain("Terminal");
    expect(document.body.textContent).toContain("Not started");
    expect(document.body.textContent).toContain("cwd");
    expect(document.body.textContent).toContain("~");
    expect(document.body.textContent).toContain("shell");
    expect(document.body.textContent).toContain("state");
    expect(document.body.textContent).toContain("not started");
    expect(document.body.textContent).toContain("exit");
    expect(document.body.textContent).toContain("none");
    expect(document.body.textContent).toContain(
      "Starting default shell...",
    );
    expect(
      document.querySelector('[aria-label="Terminal PTY output"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-xterm-open="true"]'),
    ).not.toBeNull();
    expect(
      document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Type a command"]',
      ),
    ).toBeNull();
    expect(buttonWithText("Send")).toBeUndefined();
    expect(buttonWithText("Restart")).not.toBeNull();

    expect(document.body.textContent).toContain("Terminal settings");
    expect(document.body.textContent).not.toContain("Working directory");
    expect(document.body.textContent).not.toContain("Shell executable");
    expect(document.body.textContent).not.toContain("Shell args");
    expect(document.body.textContent).not.toContain("Columns");
    expect(document.body.textContent).not.toContain("Rows");
    expect(document.body.textContent).not.toContain("Output cap bytes");
    expect(document.body.textContent).not.toContain(
      "Legacy one-shot command fallback",
    );
  });

  it("auto-starts one default PTY session in StrictMode and does not run fallback commands", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: "Windows PowerShell\r\nPS ~> ",
        status: "running",
        workingDirectory: "C:\\Users\\Dmitry",
      }),
    );
    const onRunTerminalCommand = vi.fn();

    renderWidget(
      { onCreateTerminalPtySession, onRunTerminalCommand },
      { strictMode: true },
    );
    await settleTerminalStartup();

    expect(onCreateTerminalPtySession).toHaveBeenCalledTimes(1);
    expect(onCreateTerminalPtySession.mock.calls[0][1]).toEqual({
      cols: 80,
      outputBufferCapBytes: 65536,
      rows: 24,
      shell: "",
      shellArgs: [],
      workingDirectory: "~",
    });
    expect(onRunTerminalCommand).not.toHaveBeenCalled();
  });

  it("creates and disposes the xterm Terminal with the PTY panel lifecycle", () => {
    renderWidget();

    expect(xtermMockState.terminals).toHaveLength(1);
    const terminal = latestTerminal();
    expect(terminal.open).toHaveBeenCalledTimes(1);

    act(() => {
      root?.unmount();
    });

    expect(terminal.dispose).toHaveBeenCalledTimes(1);
    expect(terminal.disposed).toBe(true);
  });

  it("keeps PTY settings and legacy fallback accessible inside settings", async () => {
    renderWidget();

    await clickText("Terminal settings");

    expect(document.body.textContent).toContain("Working directory");
    expect(inputWithLabel("Working directory")?.value).toBe("~");
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

  it("starts from the default home-relative working directory without changing the create request shape", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: "Windows PowerShell\r\nPS ~> ",
        status: "running",
        workingDirectory: "C:\\Users\\Dmitry",
      }),
    );

    renderWidget({ onCreateTerminalPtySession });
    await settleTerminalStartup();

    expect(onCreateTerminalPtySession).toHaveBeenCalledTimes(1);
    expect(onCreateTerminalPtySession.mock.calls[0][1]).toEqual({
      cols: 80,
      outputBufferCapBytes: 65536,
      rows: 24,
      shell: "",
      shellArgs: [],
      workingDirectory: "~",
    });
  });

  it("resolves home-relative working directories for the desktop request boundary", () => {
    expect(resolveTerminalWorkingDirectoryWithHome("~", "C:\\Users\\Dmitry")).toBe(
      "C:\\Users\\Dmitry",
    );
    expect(
      resolveTerminalWorkingDirectoryWithHome("~/project", "C:\\Users\\Dmitry"),
    ).toBe("C:\\Users\\Dmitry\\project");
  });

  it("restarts with edited PTY settings after the auto-started session is closed", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >()
      .mockResolvedValueOnce(
        terminalSession({
          outputText: "Windows PowerShell\r\nPS ~> ",
          status: "exited",
          workingDirectory: "C:\\Users\\Dmitry",
        }),
      )
      .mockResolvedValueOnce(
        terminalSession({
          outputText: "Windows PowerShell\r\nPS C:\\repo> ",
          sessionId: "pty_2",
          status: "running",
          workingDirectory: "C:\\repo",
        }),
      );
    const onCloseTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: PtyActionInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "closed", workingDirectory: "C:\\Users\\Dmitry" }),
    );

    renderWidget({ onCloseTerminalPtySession, onCreateTerminalPtySession });
    await settleTerminalStartup();

    await clickButton("Close");
    await clickText("Terminal settings");
    await changeInputByLabel("Working directory", "C:\\repo");
    await clickButton("Restart");

    expect(onCreateTerminalPtySession).toHaveBeenCalledTimes(2);
    expect(onCreateTerminalPtySession.mock.calls[0][0]).toBe("terminal_widget");
    expect(onCreateTerminalPtySession.mock.calls[1][1]).toEqual({
      cols: 80,
      outputBufferCapBytes: 65536,
      rows: 24,
      shell: "",
      shellArgs: [],
      workingDirectory: "C:\\repo",
    });
    expect(document.body.textContent).toContain("Running");
    expect(document.querySelector(".terminal-shell")?.textContent).not.toContain(
      "Running",
    );
    expect(buttonWithText("Stop")).not.toBeNull();
  });

  it("writes raw PTY output to xterm without frontend ANSI stripping", async () => {
    const rawOutput =
      "\x1B[m\x1B[?25l\x1B[93mhello\x1B[0m\r\nnormal output\x07\r\n";
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: rawOutput,
        status: "running",
        workingDirectory: "C:\\repo",
      }),
    );

    renderWidget({ onCreateTerminalPtySession });
    await settleTerminalStartup();

    expect(latestTerminal().write).toHaveBeenCalledWith(rawOutput);
  });

  it("sends raw xterm input through the existing write callback shape", async () => {
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
    await settleTerminalStartup();

    await act(async () => {
      latestTerminal().emitData("echo hello\r");
      await Promise.resolve();
    });

    expect(onWriteTerminalPtySession).toHaveBeenCalledTimes(1);
    expect(onWriteTerminalPtySession.mock.calls[0][0]).toBe("terminal_widget");
    expect(onWriteTerminalPtySession.mock.calls[0][1]).toEqual({
      data: "echo hello\r",
      sessionId: "pty_1",
    });
    expect(latestTerminal().write).toHaveBeenCalledWith("echo hello\r\nhello\r\n");
  });

  it("sends control, escape, and arrow-key sequences as raw xterm data", async () => {
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
      terminalSession({ status: "running", workingDirectory: "C:\\repo" }),
    );

    renderWidget({ onCreateTerminalPtySession, onWriteTerminalPtySession });
    await settleTerminalStartup();

    await act(async () => {
      latestTerminal().emitData("\x03");
      latestTerminal().emitData("\x1B");
      latestTerminal().emitData("\x1B[A");
      await Promise.resolve();
    });

    expect(onWriteTerminalPtySession.mock.calls.map((call) => call[1].data)).toEqual([
      "\x03",
      "\x1B",
      "\x1B[A",
    ]);
    expect(latestTerminal().focus).toHaveBeenCalled();
  });

  it("does not send PTY input before the operator starts a session", async () => {
    const onWriteTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: WritePtyInput,
      ) => Promise<TerminalPtySession>
    >();

    renderWidget({ onWriteTerminalPtySession });

    await act(async () => {
      latestTerminal().emitData("dir\r");
      await Promise.resolve();
    });

    expect(onWriteTerminalPtySession).not.toHaveBeenCalled();
  });

  it("fits xterm and sends the fitted columns and rows through the resize callback", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "running", workingDirectory: "C:\\repo" }),
    );
    const onResizeTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: ResizePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        cols: 100,
        rows: 32,
        status: "running",
        workingDirectory: "C:\\repo",
      }),
    );

    renderWidget({ onCreateTerminalPtySession, onResizeTerminalPtySession });
    await settleTerminalStartup();

    latestTerminal().cols = 100;
    latestTerminal().rows = 32;
    window.dispatchEvent(new Event("resize"));
    await act(async () => {
      await Promise.resolve();
    });

    const latestFitAddon =
      xtermMockState.fitAddons[xtermMockState.fitAddons.length - 1];
    expect(latestFitAddon?.fit).toHaveBeenCalled();
    expect(onResizeTerminalPtySession).toHaveBeenCalledWith("terminal_widget", {
      cols: 100,
      rows: 32,
      sessionId: "pty_1",
    });
  });

  it("preserves Stop and Close request shapes", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "running", workingDirectory: "C:\\repo" }),
    );
    const onStopTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: PtyActionInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "stopped", workingDirectory: "C:\\repo" }),
    );
    const onCloseTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: PtyActionInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "closed", workingDirectory: "C:\\repo" }),
    );

    renderWidget({
      onCloseTerminalPtySession,
      onCreateTerminalPtySession,
      onStopTerminalPtySession,
    });
    await settleTerminalStartup();
    await clickButton("Stop");
    await clickButton("Close");

    expect(onStopTerminalPtySession).toHaveBeenCalledWith("terminal_widget", {
      sessionId: "pty_1",
    });
    expect(onCloseTerminalPtySession).toHaveBeenCalledWith("terminal_widget", {
      sessionId: "pty_1",
    });
  });

  it("copies visible terminal text from the xterm buffer and clears only the frontend display", async () => {
    const writeText = vi.fn<(_: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: "ready\r\nPS C:\\repo> ",
        status: "running",
        workingDirectory: "C:\\repo",
      }),
    );

    renderWidget({ onCreateTerminalPtySession });
    await settleTerminalStartup();
    await clickButton("Copy");
    await clickButton("Clear");

    expect(writeText).toHaveBeenCalledWith("ready\nPS C:\\repo>");
    expect(latestTerminal().bufferText).toBe("");
  });

  it("does not copy stale backend text after the frontend terminal is cleared", async () => {
    const writeText = vi.fn<(_: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({
        outputText: "ready\r\nPS C:\\repo> ",
        status: "running",
        workingDirectory: "C:\\repo",
      }),
    );

    renderWidget({ onCreateTerminalPtySession });
    await settleTerminalStartup();
    await clickButton("Clear");
    await clickButton("Copy");

    expect(writeText).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("No output to copy.");
  });

  it("shows ended session state and starts a new session after close", async () => {
    const onCreateTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: CreatePtyInput,
      ) => Promise<TerminalPtySession>
    >()
      .mockResolvedValueOnce(
        terminalSession({
          exitCode: 7,
          outputText: "done\r\n",
          status: "exited",
          workingDirectory: "C:\\repo",
        }),
      )
      .mockResolvedValueOnce(
        terminalSession({
          outputText: "new session\r\n",
          sessionId: "pty_2",
          status: "running",
          workingDirectory: "C:\\repo",
        }),
      );
    const onCloseTerminalPtySession = vi.fn<
      (
        widgetInstanceId: string,
        request: PtyActionInput,
      ) => Promise<TerminalPtySession>
    >(async () =>
      terminalSession({ status: "closed", workingDirectory: "C:\\repo" }),
    );

    renderWidget({ onCloseTerminalPtySession, onCreateTerminalPtySession });
    await settleTerminalStartup();

    expect(document.body.textContent).toContain(
      "Session exited with code 7. Close it before starting a new session.",
    );
    expect(document.querySelector(".terminal-shell")?.textContent).toContain(
      "exited",
    );
    expect(document.querySelector(".terminal-shell")?.textContent).toContain(
      "7",
    );
    expect(buttonWithText("Close")).not.toBeNull();
    expect(buttonWithText("Stop")).toBeUndefined();

    await clickButton("Close");

    expect(document.body.textContent).toContain(
      "Session closed. Restart creates a new explicit session.",
    );
    expect(buttonWithText("Restart")).not.toBeNull();

    await clickButton("Restart");

    expect(onCreateTerminalPtySession).toHaveBeenCalledTimes(2);
    expect(latestTerminal().write).toHaveBeenLastCalledWith("new session\r\n");
  });
});

function renderWidget(
  overrides: Partial<Parameters<typeof TerminalPlaceholderWidget>[0]> = {},
  options: { strictMode?: boolean } = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const widget = (
    <TerminalPlaceholderWidget
      config={{}}
      definition={definition()}
      instance={instance()}
      title="Terminal"
      {...overrides}
    />
  );

  act(() => {
    root?.render(options.strictMode ? <StrictMode>{widget}</StrictMode> : widget);
  });
}

async function settleTerminalStartup() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
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
    if (element instanceof HTMLElement && element.tagName === "SUMMARY") {
      const details = element.closest("details");
      if (!details) {
        throw new Error(`Details owner not found: ${text}`);
      }
      details.open = !details.open;
      details.dispatchEvent(new Event("toggle", { bubbles: false }));
    } else {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await Promise.resolve();
  });
}

async function changeInputByLabel(labelText: string, value: string) {
  await act(async () => {
    const input = inputWithLabel(labelText);
    if (!input) {
      throw new Error(`Input not found for label: ${labelText}`);
    }
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function inputWithLabel(labelText: string) {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) => candidate.textContent?.includes(labelText),
  );
  if (!label) {
    return null;
  }
  const id = label.getAttribute("for");
  return id ? (document.getElementById(id) as HTMLInputElement | null) : null;
}

function setNativeInputValue(field: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, value);
}

function latestTerminal() {
  const terminal = xtermMockState.terminals[xtermMockState.terminals.length - 1];
  if (!terminal) {
    throw new Error("Mock xterm Terminal was not created.");
  }
  return terminal;
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
  cols = 80,
  exitCode = null,
  outputText = "",
  rows = 24,
  sessionId = "pty_1",
  status = "running",
  workingDirectory = "C:\\repo",
}: {
  cols?: number;
  exitCode?: number | null;
  outputText?: string;
  rows?: number;
  sessionId?: string;
  status?: string;
  workingDirectory?: string;
} = {}): TerminalPtySession {
  return {
    endedAt: null,
    errorMessage: null,
    exitCode,
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
    rows,
    cols,
    sessionId,
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
