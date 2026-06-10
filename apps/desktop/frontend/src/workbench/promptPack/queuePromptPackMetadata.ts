import type { AgentQueueTask } from "../../workspace/types";

export type QueuePromptPackImportMetadata = {
  allowedScope: string[];
  blockId: string | null;
  dependencies: string[];
  expectedCommitTitle: string | null;
  forbiddenScope: string[];
  packId: string | null;
  packName: string | null;
  validationCommands: string[];
};

const PROMPT_METADATA_MARKER = "Prompt pack materialization metadata";
const LIST_SECTION_LABELS = new Set([
  "Allowed scope",
  "Forbidden scope",
  "Validation commands",
]);

export function getQueuePromptPackImportMetadata(
  task: AgentQueueTask,
): QueuePromptPackImportMetadata | null {
  const promptMetadata = parsePromptMetadata(task.prompt);
  const descriptionMetadata = parseDescriptionMetadata(task.description);
  const titleBlockId = parseTitleBlockId(task.title);
  const blockId =
    promptMetadata.blockId ?? descriptionMetadata.blockId ?? titleBlockId;
  const packName = promptMetadata.packName ?? descriptionMetadata.packName;
  const packId = promptMetadata.packId ?? descriptionMetadata.packId;

  if (!promptMetadata.found && !descriptionMetadata.found && !titleBlockId) {
    return null;
  }

  return {
    allowedScope: promptMetadata.allowedScope,
    blockId,
    dependencies: promptMetadata.dependencies,
    expectedCommitTitle: promptMetadata.expectedCommitTitle,
    forbiddenScope: promptMetadata.forbiddenScope,
    packId,
    packName,
    validationCommands: promptMetadata.validationCommands,
  };
}

function parsePromptMetadata(prompt: string) {
  const markerIndex = prompt.lastIndexOf(PROMPT_METADATA_MARKER);

  if (markerIndex < 0) {
    return emptyPromptMetadata(false);
  }

  const lines = prompt
    .slice(markerIndex + PROMPT_METADATA_MARKER.length)
    .split(/\r?\n/)
    .map((line) => line.trim());
  const metadata = emptyPromptMetadata(true);
  let activeList: "allowedScope" | "forbiddenScope" | "validationCommands" | null =
    null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line.startsWith("- ") && activeList) {
      metadata[activeList].push(line.slice(2).trim());
      continue;
    }

    activeList = null;

    if (LIST_SECTION_LABELS.has(line)) {
      activeList = listKeyForLabel(line);
      continue;
    }

    const [label, value] = splitLabelValue(line);

    if (!label) {
      continue;
    }

    if (LIST_SECTION_LABELS.has(label)) {
      activeList = listKeyForLabel(label);
      if (value) {
        metadata[activeList].push(value);
      }
      continue;
    }

    switch (label) {
      case "Block id":
        metadata.blockId = value || null;
        break;
      case "Expected commit title":
        metadata.expectedCommitTitle = value || null;
        break;
      case "Pack": {
        const pack = parsePackLine(value);
        metadata.packName = pack.name;
        metadata.packId = pack.id;
        break;
      }
      case "Prompt-pack dependencies":
        metadata.dependencies = splitCsv(value);
        break;
    }
  }

  return metadata;
}

function parseDescriptionMetadata(description: string) {
  const metadata = {
    blockId: null as string | null,
    found: false,
    packId: null as string | null,
    packName: null as string | null,
  };

  for (const line of description.split(/\r?\n/).map((item) => item.trim())) {
    const [label, value] = splitLabelValue(line);

    if (label === "Prompt pack") {
      const pack = parsePackLine(value);
      metadata.found = true;
      metadata.packName = pack.name;
      metadata.packId = pack.id;
    }

    if (label === "Prompt item") {
      metadata.found = true;
      metadata.blockId = value || null;
    }
  }

  return metadata;
}

function parsePackLine(value: string) {
  const match = value.match(/^(.*)\s+\(([^()]+)\)$/);

  if (!match) {
    return { id: null, name: value || null };
  }

  return {
    id: match[2]?.trim() || null,
    name: match[1]?.trim() || null,
  };
}

function parseTitleBlockId(title: string) {
  const match = title.match(/^([^:\s][^:]*):\s+.+$/);
  return match?.[1]?.trim() || null;
}

function splitLabelValue(line: string): [string | null, string] {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex < 0) {
    return [null, ""];
  }

  return [
    line.slice(0, separatorIndex).trim(),
    line.slice(separatorIndex + 1).trim(),
  ];
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listKeyForLabel(label: string) {
  switch (label) {
    case "Allowed scope":
      return "allowedScope" as const;
    case "Forbidden scope":
      return "forbiddenScope" as const;
    case "Validation commands":
      return "validationCommands" as const;
    default:
      return "validationCommands" as const;
  }
}

function emptyPromptMetadata(found: boolean) {
  return {
    allowedScope: [] as string[],
    blockId: null as string | null,
    dependencies: [] as string[],
    expectedCommitTitle: null as string | null,
    forbiddenScope: [] as string[],
    found,
    packId: null as string | null,
    packName: null as string | null,
    validationCommands: [] as string[],
  };
}
