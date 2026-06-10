import type { KnowledgeDocumentImportFile } from "../../workspace/types";
import type { PromptPackFileEntry, PromptPackSourceAdapterStatus } from "./promptPackModel";
import { PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER } from "./promptPackImportPreview";

export const PROMPT_PACK_FOLDER_OR_ZIP_SOURCE_STATUS: PromptPackSourceAdapterStatus =
  PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER;

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
