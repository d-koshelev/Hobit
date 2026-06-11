import { invoke } from "@tauri-apps/api/core";

import type {
  PromptPackImportSource,
  ReadPromptPackSourceRequest,
} from "./types";

type TauriPromptPackImportFile = {
  byte_size: number;
  file_name: string;
  relative_path: string;
  text: string;
};

type TauriPromptPackImportSource = {
  files: TauriPromptPackImportFile[];
  source_kind: string;
  source_path: string;
};

export async function readPromptPackSource(
  request: ReadPromptPackSourceRequest,
): Promise<PromptPackImportSource> {
  const source = await invoke<TauriPromptPackImportSource>(
    "read_prompt_pack_source",
    {
      request: {
        path: request.path,
      },
    },
  );

  return {
    files: source.files.map((file) => ({
      byteSize: file.byte_size,
      fileName: file.file_name,
      relativePath: file.relative_path,
      text: file.text,
    })),
    sourceKind: source.source_kind,
    sourcePath: source.source_path,
  };
}
