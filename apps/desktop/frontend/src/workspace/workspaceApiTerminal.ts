import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  CreateTerminalPtySessionRequest,
  ListTerminalPtySessionsRequest,
  ResizeTerminalPtySessionRequest,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  WriteTerminalPtySessionRequest,
} from "./types";

export function runTerminalCommand(
  request: RunTerminalCommandRequest,
): Promise<RunTerminalCommandResponse | null> {
  return getWorkspaceApi().runTerminalCommand(request);
}

export function createTerminalPtySession(
  request: CreateTerminalPtySessionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().createTerminalPtySession(request);
}

export function writeTerminalPtySession(
  request: WriteTerminalPtySessionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().writeTerminalPtySession(request);
}

export function resizeTerminalPtySession(
  request: ResizeTerminalPtySessionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().resizeTerminalPtySession(request);
}

export function stopTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().stopTerminalPtySession(request);
}

export function killTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().killTerminalPtySession(request);
}

export function closeTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().closeTerminalPtySession(request);
}

export function getTerminalPtySession(
  request: TerminalPtySessionActionRequest,
): Promise<TerminalPtySession | null> {
  return getWorkspaceApi().getTerminalPtySession(request);
}

export function listTerminalPtySessions(
  request: ListTerminalPtySessionsRequest,
): Promise<TerminalPtySession[]> {
  return getWorkspaceApi().listTerminalPtySessions(request);
}
