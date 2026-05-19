import { memoryWorkspaceApi } from "./memoryWorkspaceApi";
import { isTauriRuntime } from "./tauriEnvironment";
import { tauriWorkspaceApi } from "./tauriWorkspaceApi";
import type { WorkspaceApi } from "./workspaceApiTypes";

export function getWorkspaceApi(): WorkspaceApi {
  return isTauriRuntime() ? tauriWorkspaceApi : memoryWorkspaceApi;
}
