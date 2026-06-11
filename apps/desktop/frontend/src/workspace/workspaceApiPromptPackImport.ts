import { isTauriRuntime } from "./tauriEnvironment";
import { readPromptPackSource as readTauriPromptPackSource } from "./tauriPromptPackImportApi";
import type {
  PromptPackImportSource,
  ReadPromptPackSourceRequest,
} from "./types";

export function readPromptPackSource(
  request: ReadPromptPackSourceRequest,
): Promise<PromptPackImportSource> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Prompt-pack folder/file import from a local path is only available in the Tauri desktop shell.",
    );
  }

  return readTauriPromptPackSource(request);
}
