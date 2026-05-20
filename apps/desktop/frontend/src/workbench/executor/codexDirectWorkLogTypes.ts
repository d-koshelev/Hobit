import type { DirectWorkStreamEvent } from "../../workspace/types";

export type CodexDirectWorkLiveRun = {
  completedAtMs: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  exitCode: number | null;
  failedStage: string | null;
  finalMessage: string | null;
  finalStatus: string | null;
  runId: string;
  startedAtMs: number | null;
  status: string;
  stderrPreview: string;
  stdoutPreview: string;
};

export type CodexDirectWorkLiveLogEntryKind =
  | DirectWorkStreamEvent["eventKind"]
  | "stream_starting"
  | "stream_start_failed"
  | "stop_requested"
  | "stop_acknowledged"
  | "stop_not_active"
  | "stop_failed"
  | "kill_requested"
  | "kill_acknowledged"
  | "kill_not_active"
  | "kill_failed"
  | "fallback_starting"
  | "fallback_completed"
  | "fallback_failed"
  | "queue_handoff_attached";

export type CodexDirectWorkLiveLogEntryTone =
  | "neutral"
  | "info"
  | "stdout"
  | "stderr"
  | "json"
  | "success"
  | "error";

export type CodexDirectWorkLiveLogEntry = {
  deltaMs: number | null;
  detail: string;
  elapsedMs: number;
  id: string;
  kind: CodexDirectWorkLiveLogEntryKind;
  label?: string;
  rawPreview?: string;
  receivedAtMs: number;
  runId: string;
  status: string | null;
  text: string;
  tone: CodexDirectWorkLiveLogEntryTone;
};
