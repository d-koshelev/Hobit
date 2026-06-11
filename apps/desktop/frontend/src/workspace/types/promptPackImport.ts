export type ReadPromptPackSourceRequest = {
  path: string;
};

export type PromptPackImportFile = {
  byteSize: number;
  fileName: string;
  relativePath: string;
  text: string;
};

export type PromptPackImportSource = {
  files: PromptPackImportFile[];
  sourceKind: "file" | "folder" | string;
  sourcePath: string;
};
