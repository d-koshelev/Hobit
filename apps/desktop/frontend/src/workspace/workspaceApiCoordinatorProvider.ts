import { getWorkspaceApi } from "./workspaceApiRuntime";
import type {
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
} from "./types";

export function generateCoordinatorProviderResponse(
  request: GenerateCoordinatorProviderResponseRequest,
): Promise<GenerateCoordinatorProviderResponse | null> {
  return getWorkspaceApi().generateCoordinatorProviderResponse(request);
}
