import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import type { TerminalPtyOutputChunk } from "../workspace/types";

export type TerminalXtermSurfaceHandle = {
  clear: () => void;
  fit: () => void;
  focus: () => void;
  getCopyText: () => string | null;
  getVisibleText: () => string | null;
};

export type TerminalXtermSurfaceProps = {
  clearedThroughSequence: number;
  className?: string;
  isInputEnabled: boolean;
  onFitDimensions: (cols: number, rows: number) => void;
  onInputData: (data: string) => void | Promise<void>;
  onResize: (cols: number, rows: number) => void | Promise<void>;
  outputChunks: TerminalPtyOutputChunk[];
  sessionId: string | null;
  testId?: string;
};

export const TerminalXtermSurface = forwardRef<
  TerminalXtermSurfaceHandle,
  TerminalXtermSurfaceProps
>(function TerminalXtermSurface(
  {
    clearedThroughSequence,
    className,
    isInputEnabled,
    onFitDimensions,
    onInputData,
    onResize,
    outputChunks,
    sessionId,
    testId,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const lastWrittenSequenceRef = useRef(0);
  const lastResizeKeyRef = useRef("");
  const resizeInFlightRef = useRef(false);
  const latestHandlersRef = useRef({
    isInputEnabled,
    onFitDimensions,
    onInputData,
    onResize,
  });

  latestHandlersRef.current = {
    isInputEnabled,
    onFitDimensions,
    onInputData,
    onResize,
  };

  const fitAndReport = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) {
      return;
    }

    try {
      fitAddon.fit();
    } catch {
      return;
    }

    const cols = terminal.cols;
    const rows = terminal.rows;
    if (
      !Number.isFinite(cols) ||
      !Number.isFinite(rows) ||
      cols <= 0 ||
      rows <= 0
    ) {
      return;
    }

    latestHandlersRef.current.onFitDimensions(cols, rows);

    const resizeKey = `${lastSessionIdRef.current ?? "none"}:${cols}x${rows}`;
    if (
      !latestHandlersRef.current.isInputEnabled ||
      resizeInFlightRef.current ||
      resizeKey === lastResizeKeyRef.current
    ) {
      return;
    }

    resizeInFlightRef.current = true;
    lastResizeKeyRef.current = resizeKey;
    Promise.resolve(latestHandlersRef.current.onResize(cols, rows)).finally(
      () => {
        resizeInFlightRef.current = false;
        terminal.focus();
      },
    );
  }, []);

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const focusTerminalSoon = useCallback(() => {
    window.setTimeout(() => {
      terminalRef.current?.focus();
    }, 0);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        terminalRef.current?.clear();
      },
      fit() {
        fitAndReport();
      },
      focus() {
        terminalRef.current?.focus();
      },
      getCopyText() {
        const terminal = terminalRef.current;
        if (!terminal) {
          return null;
        }

        const selectedText = terminal.getSelection().trimEnd();
        if (selectedText) {
          return selectedText;
        }

        return visibleTerminalText(terminal);
      },
      getVisibleText() {
        const terminal = terminalRef.current;
        if (!terminal) {
          return null;
        }

        return visibleTerminalText(terminal);
      },
    }),
    [fitAndReport],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new XtermTerminal({
      cursorBlink: true,
      scrollback: 1000,
      theme: terminalTheme(container),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    const dataSubscription = terminal.onData((data) => {
      if (!latestHandlersRef.current.isInputEnabled) {
        return;
      }

      latestHandlersRef.current.onInputData(data);
      terminal.focus();
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    window.setTimeout(() => {
      fitAndReport();
      if (latestHandlersRef.current.isInputEnabled) {
        terminal.focus();
      }
    }, 0);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => fitAndReport());
    resizeObserver?.observe(container);
    window.addEventListener("resize", fitAndReport);

    return () => {
      window.removeEventListener("resize", fitAndReport);
      resizeObserver?.disconnect();
      dataSubscription.dispose();
      fitAddon.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fitAndReport]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (!sessionId) {
      if (lastSessionIdRef.current) {
        terminal.clear();
      }
      lastSessionIdRef.current = null;
      lastWrittenSequenceRef.current = 0;
      return;
    }

    if (lastSessionIdRef.current !== sessionId) {
      terminal.clear();
      lastSessionIdRef.current = sessionId;
      lastWrittenSequenceRef.current = clearedThroughSequence;
      lastResizeKeyRef.current = "";
      fitAndReport();
      if (isInputEnabled) {
        focusTerminalSoon();
      }
    }

    const baseline = Math.max(
      lastWrittenSequenceRef.current,
      clearedThroughSequence,
    );
    const chunksToWrite = outputChunks.filter(
      (chunk) => chunk.sequence > baseline,
    );

    for (const chunk of chunksToWrite) {
      terminal.write(chunk.text);
    }

    if (chunksToWrite.length > 0) {
      lastWrittenSequenceRef.current = maxChunkSequence(chunksToWrite);
    } else {
      lastWrittenSequenceRef.current = Math.max(
        lastWrittenSequenceRef.current,
        clearedThroughSequence,
      );
    }
  }, [
    clearedThroughSequence,
    fitAndReport,
    focusTerminalSoon,
    isInputEnabled,
    outputChunks,
    sessionId,
  ]);

  return (
    <div className={className ?? "terminal-xterm-shell"}>
      <div
        aria-label="Terminal PTY output"
        className="terminal-xterm-surface"
        data-testid={testId}
        onMouseDown={focusTerminal}
        ref={containerRef}
      />
      {!sessionId ? (
        <div className="terminal-xterm-placeholder">
          Starting default shell...
        </div>
      ) : null}
    </div>
  );
});

function visibleTerminalText(terminal: XtermTerminal) {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];

  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index);
    if (line) {
      lines.push(line.translateToString(true));
    }
  }

  return lines.join("\n");
}

function maxChunkSequence(chunks: TerminalPtyOutputChunk[]) {
  return chunks.reduce(
    (maxSequence, chunk) => Math.max(maxSequence, chunk.sequence),
    0,
  );
}

function terminalTheme(container: HTMLElement) {
  const styles = window.getComputedStyle(container);
  return {
    background: cssVar(styles, "--color-io-surface"),
    foreground: cssVar(styles, "--color-text-primary"),
    cursor: cssVar(styles, "--color-text-primary"),
    selectionBackground: cssVar(styles, "--color-accent-muted"),
  };
}

function cssVar(styles: CSSStyleDeclaration, name: string) {
  return styles.getPropertyValue(name).trim() || undefined;
}
