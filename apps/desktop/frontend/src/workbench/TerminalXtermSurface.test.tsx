import { createRef, type Ref } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TerminalPtyOutputChunk } from "../workspace/types";
import {
  TerminalXtermSurface,
  type TerminalXtermSurfaceHandle,
  type TerminalXtermSurfaceProps,
} from "./TerminalXtermSurface";

const xtermMockState = vi.hoisted(() => ({
  fitAddons: [] as Array<{
    dispose: ReturnType<typeof vi.fn>;
    fit: ReturnType<typeof vi.fn>;
  }>,
  subscriptions: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>,
  terminals: [] as Array<{
    bufferText: string;
    clear: ReturnType<typeof vi.fn>;
    cols: number;
    dispose: ReturnType<typeof vi.fn>;
    disposed: boolean;
    emitData: (data: string) => void;
    focus: ReturnType<typeof vi.fn>;
    loadAddon: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    rows: number;
    write: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@xterm/xterm", () => {
  class Terminal {
    bufferText = "";
    cols = 80;
    rows = 24;
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
      const subscription = { dispose: vi.fn() };
      xtermMockState.subscriptions.push(subscription);
      return subscription;
    }

    write = vi.fn((data: string) => {
      this.bufferText += data;
    });

    clear = vi.fn(() => {
      this.bufferText = "";
    });

    focus = vi.fn();

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
  xtermMockState.subscriptions.length = 0;
  xtermMockState.terminals.length = 0;
  vi.restoreAllMocks();
});

describe("TerminalXtermSurface", () => {
  it("creates an xterm Terminal on mount", () => {
    renderSurface();

    expect(xtermMockState.terminals).toHaveLength(1);
    expect(latestTerminal().open).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-xterm-open="true"]')).not.toBeNull();
  });

  it("disposes the xterm Terminal, FitAddon, and data subscription on unmount", () => {
    renderSurface();
    const terminal = latestTerminal();
    const fitAddon = latestFitAddon();
    const subscription = xtermMockState.subscriptions[0];

    act(() => {
      root?.unmount();
    });

    expect(subscription.dispose).toHaveBeenCalledTimes(1);
    expect(fitAddon.dispose).toHaveBeenCalledTimes(1);
    expect(terminal.dispose).toHaveBeenCalledTimes(1);
    expect(terminal.disposed).toBe(true);
  });

  it("writes incoming output chunks to terminal.write", () => {
    renderSurface({
      outputChunks: [outputChunk(1, "\x1B[93mhello\x1B[0m\r\n")],
      sessionId: "pty_1",
    });

    expect(latestTerminal().write).toHaveBeenCalledWith(
      "\x1B[93mhello\x1B[0m\r\n",
    );
  });

  it("skips chunks cleared by the clear marker during replay", () => {
    renderSurface({
      clearedThroughSequence: 1,
      outputChunks: [outputChunk(1, "old\r\n"), outputChunk(2, "new\r\n")],
      sessionId: "pty_1",
    });

    expect(latestTerminal().write).toHaveBeenCalledTimes(1);
    expect(latestTerminal().write).toHaveBeenCalledWith("new\r\n");
  });

  it("forwards raw onData input to the supplied callback", async () => {
    const onInputData = vi.fn();
    renderSurface({ isInputEnabled: true, onInputData, sessionId: "pty_1" });

    await act(async () => {
      latestTerminal().emitData("\x1B[A");
      await Promise.resolve();
    });

    expect(onInputData).toHaveBeenCalledWith("\x1B[A");
    expect(latestTerminal().focus).toHaveBeenCalled();
  });

  it("does not forward raw input while input is disabled", async () => {
    const onInputData = vi.fn();
    renderSurface({ isInputEnabled: false, onInputData, sessionId: "pty_1" });

    await act(async () => {
      latestTerminal().emitData("dir\r");
      await Promise.resolve();
    });

    expect(onInputData).not.toHaveBeenCalled();
  });

  it("fits xterm and reports resize dimensions", async () => {
    const onFitDimensions = vi.fn();
    const onResize = vi.fn(async () => {});
    renderSurface({
      isInputEnabled: true,
      onFitDimensions,
      onResize,
      sessionId: "pty_1",
    });
    await act(async () => {
      await Promise.resolve();
    });

    latestTerminal().cols = 100;
    latestTerminal().rows = 32;
    window.dispatchEvent(new Event("resize"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(latestFitAddon().fit).toHaveBeenCalled();
    expect(onFitDimensions).toHaveBeenCalledWith(100, 32);
    expect(onResize).toHaveBeenCalledWith(100, 32);
  });

  it("clears the frontend terminal display through the surface handle", () => {
    const surfaceRef = createRef<TerminalXtermSurfaceHandle>();
    renderSurface({
      outputChunks: [outputChunk(1, "ready\r\n")],
      ref: surfaceRef,
      sessionId: "pty_1",
    });

    act(() => {
      surfaceRef.current?.clear();
    });

    expect(latestTerminal().clear).toHaveBeenCalled();
    expect(latestTerminal().bufferText).toBe("");
  });

  it("returns visible xterm buffer text through the surface handle", () => {
    const surfaceRef = createRef<TerminalXtermSurfaceHandle>();
    renderSurface({
      outputChunks: [outputChunk(1, "ready\r\nPS C:\\repo> ")],
      ref: surfaceRef,
      sessionId: "pty_1",
    });

    expect(surfaceRef.current?.getVisibleText()).toBe("ready\nPS C:\\repo> ");
  });
});

function renderSurface(
  overrides: Partial<
    TerminalXtermSurfaceProps & { ref: Ref<TerminalXtermSurfaceHandle> }
  > = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  const {
    clearedThroughSequence = 0,
    isInputEnabled = false,
    onFitDimensions = vi.fn(),
    onInputData = vi.fn(),
    onResize = vi.fn(),
    outputChunks = [],
    ref = null,
    sessionId = null,
    ...rest
  } = overrides;

  act(() => {
    root?.render(
      <TerminalXtermSurface
        clearedThroughSequence={clearedThroughSequence}
        isInputEnabled={isInputEnabled}
        onFitDimensions={onFitDimensions}
        onInputData={onInputData}
        onResize={onResize}
        outputChunks={outputChunks}
        ref={ref}
        sessionId={sessionId}
        {...rest}
      />,
    );
  });
}

function outputChunk(
  sequence: number,
  text: string,
): TerminalPtyOutputChunk {
  return {
    byteLen: text.length,
    sequence,
    streamKind: "pty",
    text,
  };
}

function latestTerminal() {
  const terminal = xtermMockState.terminals[xtermMockState.terminals.length - 1];
  if (!terminal) {
    throw new Error("Mock xterm Terminal was not created.");
  }
  return terminal;
}

function latestFitAddon() {
  const fitAddon =
    xtermMockState.fitAddons[xtermMockState.fitAddons.length - 1];
  if (!fitAddon) {
    throw new Error("Mock xterm FitAddon was not created.");
  }
  return fitAddon;
}
