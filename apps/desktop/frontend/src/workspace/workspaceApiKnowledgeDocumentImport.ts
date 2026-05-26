import { isTauriRuntime } from "./tauriEnvironment";
import { readKnowledgeDocumentImportFile as readTauriKnowledgeDocumentImportFile } from "./tauriKnowledgeDocumentImportApi";
import type {
  KnowledgeDocumentImportFile,
  ReadKnowledgeDocumentImportFileRequest,
} from "./types";

export function readKnowledgeDocumentImportFile(
  request: ReadKnowledgeDocumentImportFileRequest,
): Promise<KnowledgeDocumentImportFile> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Text document import from a local path is only available in the Tauri desktop shell.",
    );
  }

  return readTauriKnowledgeDocumentImportFile(request);
}
