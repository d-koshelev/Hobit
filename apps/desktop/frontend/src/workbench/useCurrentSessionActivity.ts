import { useMemo, useState } from "react";
import type { RunTerminalCommandResponse } from "../workspace/types";
import type { GlobalActivityStatus } from "./GlobalActivityIndicator";
import type { WidgetInstanceId } from "./types";

export type CurrentSessionActivityEvents = {
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
  const [activeTerminalRunIds, setActiveTerminalRunIds] = useState<
    WidgetInstanceId[]
  >([]);
  const [attentionState, setAttentionState] =
    useState<AttentionState | null>(null);
  const activeTerminalRunCount = activeTerminalRunIds.length;

  const status = useMemo(
    () => globalActivityStatus(activeTerminalRunCount, attentionState),
    [activeTerminalRunCount, attentionState],
  );

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

  return {
    events: {
      markTerminalRunFailed,
      markTerminalRunFinished,
      markTerminalRunStarted,
    },
    status,
  };
}

function globalActivityStatus(
  activeTerminalRunCount: number,
  attentionState: AttentionState | null,
): GlobalActivityStatus {
  if (activeTerminalRunCount > 0) {
    return {
      assistiveText:
        activeTerminalRunCount === 1
          ? "Running: one current-session local Terminal command is active."
          : `Running: ${activeTerminalRunCount} current-session local Terminal commands are active.`,
      detail:
        activeTerminalRunCount === 1
          ? "Terminal command"
          : `${activeTerminalRunCount} active local runs`,
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
