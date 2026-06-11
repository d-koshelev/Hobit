import type { KnowledgeDocumentImportFile } from "../../workspace/types";
import type { PromptPackImportSource, ReadPromptPackSourceRequest } from "../../workspace/types";
import { readPromptPackSource } from "../../workspace/workspaceApiPromptPackImport";
import type { PromptPackFileEntry, PromptPackSourceAdapterStatus } from "./promptPackModel";
import {
  PROMPT_PACK_TYPED_FOLDER_SOURCE_ADAPTER,
  PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER,
} from "./promptPackImportPreview";

export const PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS: PromptPackSourceAdapterStatus =
  PROMPT_PACK_TYPED_FOLDER_SOURCE_ADAPTER;

export type ReadPromptPackSourceForImport = (
  request: ReadPromptPackSourceRequest,
) => Promise<PromptPackFileEntry[]>;

export async function readPromptPackEntriesFromLocalSource(
  request: ReadPromptPackSourceRequest,
): Promise<PromptPackFileEntry[]> {
  return promptPackEntriesFromImportSource(await readPromptPackSource(request));
}

export function promptPackEntriesFromImportSource(
  source: PromptPackImportSource,
): PromptPackFileEntry[] {
  return source.files.map((file) => ({
    name: file.fileName,
    path: file.relativePath,
    size: file.byteSize,
    source: "desktop-prompt-pack",
    text: file.text,
  }));
}

export function promptPackEntriesFromKnowledgeImportFiles(
  files: readonly KnowledgeDocumentImportFile[],
): PromptPackFileEntry[] {
  return files.map((file) => ({
    name: file.fileName,
    path: file.fileName,
    source: "desktop-file",
    text: file.content,
  }));
}
