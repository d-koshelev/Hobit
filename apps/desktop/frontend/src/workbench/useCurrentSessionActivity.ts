import { useMemo, useState } from "react";
import type {
  RunCodexDirectWorkResponse,
  RunTerminalCommandResponse,
} from "../workspace/types";
import type { GlobalActivityStatus } from "./GlobalActivityIndicator";
import type { WidgetInstanceId } from "./types";

export type CurrentSessionActivityEvents = {
  markDirectWorkRunFailed: (
    widgetInstanceId: WidgetInstanceId,
    error: unknown,
  ) => void;
  markDirectWorkRunFinished: (
    widgetInstanceId: WidgetInstanceId,
    result: RunCodexDirectWorkResponse | null,
  ) => void;
  markDirectWorkRunStarted: (widgetInstanceId: WidgetInstanceId) => void;
  markTerminalRunFailed: (
    widgetInstanceId: WidgetInstanceId,
    error: unknown,
  ) => void;
  markTerminalRunFinished: (
    widgetInstanceId: WidgetInstanceId,
    result: RunTerminalCommandResponse | null,
  ) => void;
  markTerminalRunStarted: (widgetInstanceId: WidgetInstanceId) => void;
};

type AttentionState = {
  detail: string;
};

export function useCurrentSessionActivity(): {
  events: CurrentSessionActivityEvents;
  status: GlobalActivityStatus;
} {
  const [activeDirectWorkRunIds, setActiveDirectWorkRunIds] = useState<
    WidgetInstanceId[]
  >([]);
  const [activeTerminalRunIds, setActiveTerminalRunIds] = useState<
    WidgetInstanceId[]
  >([]);
  const [attentionState, setAttentionState] =
    useState<AttentionState | null>(null);
  const activeDirectWorkRunCount = activeDirectWorkRunIds.length;
  const activeTerminalRunCount = activeTerminalRunIds.length;

  const status = useMemo(
    () =>
      globalActivityStatus(
        activeTerminalRunCount,
        activeDirectWorkRunCount,
        attentionState,
      ),
    [activeDirectWorkRunCount, activeTerminalRunCount, attentionState],
  );

  function markDirectWorkRunStarted(widgetInstanceId: WidgetInstanceId) {
    setAttentionState(null);
    setActiveDirectWorkRunIds((currentIds) =>
      currentIds.includes(widgetInstanceId)
        ? currentIds
        : [...currentIds, widgetInstanceId],
    );
  }

  function markDirectWorkRunFinished(
    widgetInstanceId: WidgetInstanceId,
    result: RunCodexDirectWorkResponse | null,
  ) {
    removeActiveDirectWorkRun(widgetInstanceId);

    if (!result) {
      setAttentionState({
        detail: "Codex Direct Work returned no result",
      });
      return;
    }

    if (result.status === "timed_out") {
      setAttentionState({
        detail: "Codex Direct Work timed out",
      });
      return;
    }

    if (result.status === "failed") {
      setAttentionState({
        detail: "Codex Direct Work failed",
      });
      return;
    }

    if (
      result.status === "completed" &&
      result.exitCode !== null &&
      result.exitCode !== 0
    ) {
      setAttentionState({
        detail: "Codex Direct Work completed with nonzero exit",
      });
    }
  }

  function markDirectWorkRunFailed(
    widgetInstanceId: WidgetInstanceId,
    _error: unknown,
  ) {
    removeActiveDirectWorkRun(widgetInstanceId);
    setAttentionState({
      detail: "Codex Direct Work request failed",
    });
  }

  function markTerminalRunStarted(widgetInstanceId: WidgetInstanceId) {
    setAttentionState(null);
    setActiveTerminalRunIds((currentIds) =>
      currentIds.includes(widgetInstanceId)
        ? currentIds
        : [...currentIds, widgetInstanceId],
    );
  }

  function markTerminalRunFinished(
    widgetInstanceId: WidgetInstanceId,
    result: RunTerminalCommandResponse | null,
  ) {
    removeActiveTerminalRun(widgetInstanceId);

    if (!result) {
      setAttentionState({
        detail: "Terminal command returned no result",
      });
      return;
    }

    if (result.status === "timed_out") {
      setAttentionState({
        detail: "Terminal command timed out",
      });
      return;
    }

    if (result.status === "failed" || result.status === "failed_to_start") {
      setAttentionState({
        detail: "Terminal command failed",
      });
    }
  }

  function markTerminalRunFailed(
    widgetInstanceId: WidgetInstanceId,
    _error: unknown,
  ) {
    removeActiveTerminalRun(widgetInstanceId);
    setAttentionState({
      detail: "Terminal command request failed",
    });
  }

  function removeActiveTerminalRun(widgetInstanceId: WidgetInstanceId) {
    setActiveTerminalRunIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== widgetInstanceId),
    );
  }

  function removeActiveDirectWorkRun(widgetInstanceId: WidgetInstanceId) {
    setActiveDirectWorkRunIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== widgetInstanceId),
    );
  }

  return {
    events: {
      markDirectWorkRunFailed,
      markDirectWorkRunFinished,
      markDirectWorkRunStarted,
      markTerminalRunFailed,
      markTerminalRunFinished,
      markTerminalRunStarted,
    },
    status,
  };
}

function globalActivityStatus(
  activeTerminalRunCount: number,
  activeDirectWorkRunCount: number,
  attentionState: AttentionState | null,
): GlobalActivityStatus {
  const activeRunCount = activeTerminalRunCount + activeDirectWorkRunCount;

  if (activeRunCount > 0) {
    const detailParts = [
      activeTerminalRunCount > 0
        ? activeTerminalRunCount === 1
          ? "Terminal command"
          : `${activeTerminalRunCount} Terminal commands`
        : null,
      activeDirectWorkRunCount > 0
        ? activeDirectWorkRunCount === 1
          ? "Codex Direct Work"
          : `${activeDirectWorkRunCount} Codex Direct Work runs`
        : null,
    ].filter(Boolean);

    return {
      assistiveText:
        activeRunCount === 1
          ? `Running: one current-session local run is active (${detailParts.join(
              ", ",
            )}).`
          : `Running: ${activeRunCount} current-session local runs are active (${detailParts.join(
              ", ",
            )}).`,
      detail: detailParts.join(", "),
      kind: "running",
      label: "Running",
    };
  }

  if (attentionState) {
    return {
      assistiveText: `Attention needed: ${attentionState.detail}.`,
      detail: attentionState.detail,
      kind: "attention",
      label: "Attention needed",
    };
  }

  return {
    assistiveText:
      "Idle: no current-session local runs are active. Background scheduler and Agent runtime monitoring are not implemented.",
    detail: "No active local runs",
    kind: "idle",
    label: "Idle",
  };
}
