import { invoke } from "@tauri-apps/api/core";
import type {
  KnowledgeDocumentImportFile,
  ReadKnowledgeDocumentImportFileRequest,
} from "./types";

type TauriKnowledgeDocumentImportFile = {
  file_name: string;
  title: string;
  content: string;
};

export async function readKnowledgeDocumentImportFile(
  request: ReadKnowledgeDocumentImportFileRequest,
): Promise<KnowledgeDocumentImportFile> {
  const imported = await invoke<TauriKnowledgeDocumentImportFile>(
    "read_knowledge_document_import_file",
    {
      request: {
        path: request.path,
      },
    },
  );

  return {
    fileName: imported.file_name,
    title: imported.title,
    content: imported.content,
  };
}
