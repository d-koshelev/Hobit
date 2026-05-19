import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CancelCodexDirectWorkRunRequest,
  CancelCodexDirectWorkRunResponse,
  DirectWorkStreamEvent,
  ForceKillCodexDirectWorkRunRequest,
  ForceKillCodexDirectWorkRunResponse,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  StartCodexDirectWorkStreamRequest,
  StartCodexDirectWorkStreamResponse,
} from "./types";

export function runCodexDirectWork(
  request: RunCodexDirectWorkRequest,
): Promise<RunCodexDirectWorkResponse | null> {
  return getWorkspaceApi().runCodexDirectWork(request);
}

export function runDirectWorkValidation(
  request: RunDirectWorkValidationRequest,
): Promise<RunDirectWorkValidationResponse | null> {
  return getWorkspaceApi().runDirectWorkValidation(request);
}

export function cancelCodexDirectWorkRun(
  request: CancelCodexDirectWorkRunRequest,
): Promise<CancelCodexDirectWorkRunResponse | null> {
  return getWorkspaceApi().cancelCodexDirectWorkRun(request);
}

export function forceKillCodexDirectWorkRun(
  request: ForceKillCodexDirectWorkRunRequest,
): Promise<ForceKillCodexDirectWorkRunResponse | null> {
  return getWorkspaceApi().forceKillCodexDirectWorkRun(request);
}

export function startCodexDirectWorkStream(
  request: StartCodexDirectWorkStreamRequest,
): Promise<StartCodexDirectWorkStreamResponse | null> {
  return getWorkspaceApi().startCodexDirectWorkStream(request);
}

export function listenToDirectWorkStreamEvents(
  onEvent: (event: DirectWorkStreamEvent) => void,
): Promise<() => void> {
  return getWorkspaceApi().listenToDirectWorkStreamEvents(onEvent);
}
