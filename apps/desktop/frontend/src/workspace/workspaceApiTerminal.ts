import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
} from "./types";

export function runTerminalCommand(
  request: RunTerminalCommandRequest,
): Promise<RunTerminalCommandResponse | null> {
  return getWorkspaceApi().runTerminalCommand(request);
}
