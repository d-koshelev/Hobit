import type {
  ParsePromptPackOptions,
  PromptPackDependencyPolicy,
  PromptPackDiagnostic,
  PromptPackFileEntry,
  PromptPackImportItem,
  PromptPackImportPlan,
  PromptPackMetadata,
} from "./promptPackModel";
import {
  NUMBERED_PROMPT_PATTERN,
  basename,
  errorToMessage,
  firstMarkdownHeading,
  humanizeSlug,
  isRecord,
  markdownBody,
  markdownTitle,
  normalizeDependencyPolicy,
  normalizePriority,
  numberValue,
  numberedPromptParts,
  parentDirectory,
  promptPackMetadataSection,
  slugify,
  stringList,
  stringValue,
  type UnknownRecord,
} from "./promptPackText";

type ItemDraft = {
  allowedScope: string[];
  dependencies: string[];
  executionWorkspace: string | null;
  expectedCommitTitle: string | null;
  forbiddenScope: string[];
  id: string | null;
  modelProfile: string | null;
  numericOrder: number | null;
  path: string | null;
  priority: number;
  promptBody: string;
  reasoningEffort: string | null;
  tags: string[];
  title: string | null;
  validationCommands: string[];
  validatorProfile: string | null;
};

const DEFAULT_PACK_ID = "prompt-pack";
const HEADER_ALIASES: Record<string, keyof ItemDraft> = {
  "allowed scope": "allowedScope",
  "allowedscope": "allowedScope",
  "block id": "id",
  "dependencies": "dependencies",
  "depends on": "dependencies",
  "execution root": "executionWorkspace",
  "execution workspace": "executionWorkspace",
  "executionroot": "executionWorkspace",
  "executionworkspace": "executionWorkspace",
  "expected commit title": "expectedCommitTitle",
  "expectedcommittitle": "expectedCommitTitle",
  "forbidden scope": "forbiddenScope",
  "forbiddenscope": "forbiddenScope",
  "id": "id",
  "item id": "id",
  "model profile": "modelProfile",
  "modelprofile": "modelProfile",
  "model": "modelProfile",
  "priority": "priority",
  "repository root": "executionWorkspace",
  "repositoryroot": "executionWorkspace",
  "reasoning effort": "reasoningEffort",
  "reasoningeffort": "reasoningEffort",
  "repo root": "executionWorkspace",
  "reporoot": "executionWorkspace",
  "tags": "tags",
  "validation": "validationCommands",
  "validation commands": "validationCommands",
  "validator profile": "validatorProfile",
  "validatorprofile": "validatorProfile",
};

export function parsePromptPackImportPlan(
  inputEntries: readonly PromptPackFileEntry[],
  options: ParsePromptPackOptions = {},
): PromptPackImportPlan {
  const entries = inputEntries.map((entry) => normalizeEntry(entry));
  const diagnostics: PromptPackDiagnostic[] = [];

  if (entries.length === 0) {
    diagnostics.push({
      code: "empty_input",
      message: "Prompt pack import needs at least one in-memory file entry.",
      severity: "error",
    });
  }

  const manifestEntry = entries.find((entry) =>
    basename(entry.path).toLowerCase() === "prompt-batch.json",
  );
  const readmeEntry = entries.find((entry) =>
    basename(entry.path).toLowerCase() === "readme.md",
  );
  const manifest = parseManifest(manifestEntry, diagnostics);
  const manifestDependencyPolicy = normalizeDependencyPolicy(
    stringValue(manifest, ["dependencyPolicy", "dependency_policy"]),
  );
  const dependencyPolicy =
    options.dependencyPolicy ??
    manifestDependencyPolicy ??
    "suggest_numeric_order";
  const pack = normalizePackMetadata({
    entries,
    manifest,
    readmeText: readmeEntry?.text ?? null,
  });

  if (!manifest?.id && !manifest?.name && !readmeEntry) {
    diagnostics.push({
      code: "pack_metadata_missing",
      message:
        "No README.md heading or prompt-batch.json pack metadata was found; using a generated prompt-pack identity.",
      severity: "warning",
    });
  }

  const fileByPath = new Map(entries.map((entry) => [entry.path.toLowerCase(), entry]));
  const drafts = [
    ...manifestItems(manifest, fileByPath, options),
    ...numberedMarkdownItems(entries, manifest, options),
  ];

  for (const entry of entries) {
    const base = basename(entry.path).toLowerCase();
    const isKnown =
      base === "readme.md" ||
      base === "prompt-batch.json" ||
      NUMBERED_PROMPT_PATTERN.test(entry.path);
    if (!isKnown) {
      diagnostics.push({
        code: "unsupported_file",
        message: `File "${entry.path}" is not a README, prompt-batch manifest, or numbered Markdown prompt.`,
        path: entry.path,
        severity: "warning",
      });
    }
  }

  const items = normalizeItems(drafts, pack, dependencyPolicy, diagnostics);
  validateDependencies(items, diagnostics);

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  );

  return {
    dependencyPolicy,
    diagnostics,
    errors,
    items,
    pack,
    warnings,
  };
}

function normalizeEntry(entry: PromptPackFileEntry) {
  const rawPath = entry.path?.trim() || entry.name?.trim() || "untitled";
  return {
    name: entry.name,
    path: rawPath.replace(/\\/g, "/"),
    size: entry.size,
    source: entry.source,
    text: entry.text,
  };
}

function parseManifest(
  entry: ReturnType<typeof normalizeEntry> | undefined,
  diagnostics: PromptPackDiagnostic[],
) {
  if (!entry) {
    return null;
  }

  try {
    const parsed = JSON.parse(entry.text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    diagnostics.push({
      code: "invalid_json",
      message: `prompt-batch.json could not be parsed: ${errorToMessage(error)}`,
      path: entry.path,
      severity: "error",
    });
    return null;
  }
}

function normalizePackMetadata({
  entries,
  manifest,
  readmeText,
}: {
  entries: Array<ReturnType<typeof normalizeEntry>>;
  manifest: UnknownRecord | null;
  readmeText: string | null;
}): PromptPackMetadata {
  const readmeTitle = readmeText ? firstMarkdownHeading(readmeText) : null;
  const manifestId = stringValue(manifest, ["id", "packId", "pack_id"]);
  const manifestName = stringValue(manifest, ["name", "title", "packName"]);
  const inferredName = readmeTitle ?? manifestName ?? parentDirectory(entries[0]?.path);
  const name = manifestName ?? inferredName ?? "Prompt Pack";
  const id = slugify(manifestId ?? name) || DEFAULT_PACK_ID;

  return {
    id,
    name,
    sourcePaths: entries.map((entry) => entry.path),
  };
}

function manifestItems(
  manifest: UnknownRecord | null,
  fileByPath: Map<string, ReturnType<typeof normalizeEntry>>,
  options: ParsePromptPackOptions,
): ItemDraft[] {
  if (!manifest) {
    return [];
  }

  return arrayFromManifest(manifest).map((item) => {
    const filePath = stringValue(item, ["path", "file", "sourcePath", "source"]);
    const file = filePath ? fileByPath.get(filePath.replace(/\\/g, "/").toLowerCase()) : undefined;
    const body =
      stringValue(item, ["prompt", "body", "text", "content"]) ??
      (file ? markdownBody(file.text) : "");
    const filename = filePath ?? file?.path ?? null;
    const filenameParts = filename ? numberedPromptParts(filename) : null;

    return {
      allowedScope: stringList(item, ["allowedScope", "allowed_scope", "allowed"]),
      dependencies: stringList(item, ["dependencies", "dependsOn", "depends_on"]),
      executionWorkspace:
        stringValue(item, [
          "executionWorkspace",
          "execution_workspace",
          "executionRoot",
          "execution_root",
          "repoRoot",
          "repo_root",
          "repositoryRoot",
          "repository_root",
          "workingDirectory",
          "working_directory",
        ]) ?? null,
      expectedCommitTitle:
        stringValue(item, ["expectedCommitTitle", "expected_commit_title"]) ?? null,
      forbiddenScope: stringList(item, [
        "forbiddenScope",
        "forbidden_scope",
        "forbidden",
      ]),
      id:
        stringValue(item, ["id", "itemId", "blockId", "key"]) ??
        filenameParts?.id ??
        null,
      modelProfile:
        stringValue(item, ["modelProfile", "model_profile", "model"]) ??
        options.defaultModelProfile ??
        null,
      numericOrder: filenameParts?.numericOrder ?? numberValue(item, ["order", "index"]),
      path: filename,
      priority: normalizePriority(numberValue(item, ["priority"])),
      promptBody: body,
      reasoningEffort:
        stringValue(item, ["reasoningEffort", "reasoning_effort"]) ??
        options.defaultReasoningEffort ??
        null,
      tags: stringList(item, ["tags", "queueTags", "queue_tags"]),
      title:
        stringValue(item, ["title", "name"]) ??
        (file ? markdownTitle(file.text, file.path) : null) ??
        filenameParts?.title ??
        null,
      validationCommands: stringList(item, [
        "validationCommands",
        "validation_commands",
        "validation",
      ]),
      validatorProfile:
        stringValue(item, ["validatorProfile", "validator_profile"]) ??
        options.defaultValidatorProfile ??
        null,
    };
  });
}

function numberedMarkdownItems(
  entries: Array<ReturnType<typeof normalizeEntry>>,
  manifest: UnknownRecord | null,
  options: ParsePromptPackOptions,
): ItemDraft[] {
  const manifestPaths = new Set(
    arrayFromManifest(manifest)
      .map((item) => stringValue(item, ["path", "file", "sourcePath", "source"]))
      .filter((path): path is string => Boolean(path))
      .map((path) => path.replace(/\\/g, "/").toLowerCase()),
  );

  return entries
    .filter((entry) => NUMBERED_PROMPT_PATTERN.test(entry.path))
    .filter((entry) => !manifestPaths.has(entry.path.toLowerCase()))
    .map((entry) => {
      const parts = numberedPromptParts(entry.path);
      const headers = parsePromptHeaders(entry.text);
      return {
        allowedScope: headers.allowedScope,
        dependencies: headers.dependencies,
        executionWorkspace: headers.executionWorkspace,
        expectedCommitTitle: headers.expectedCommitTitle,
        forbiddenScope: headers.forbiddenScope,
        id: headers.id ?? parts?.id ?? null,
        modelProfile: headers.modelProfile ?? options.defaultModelProfile ?? null,
        numericOrder: parts?.numericOrder ?? null,
        path: entry.path,
        priority: headers.priority,
        promptBody: markdownBody(entry.text),
        reasoningEffort:
          headers.reasoningEffort ?? options.defaultReasoningEffort ?? null,
        tags: headers.tags,
        title: markdownTitle(entry.text, entry.path) ?? parts?.title ?? null,
        validationCommands: headers.validationCommands,
        validatorProfile:
          headers.validatorProfile ?? options.defaultValidatorProfile ?? null,
      };
    });
}

function normalizeItems(
  drafts: ItemDraft[],
  pack: PromptPackMetadata,
  dependencyPolicy: PromptPackDependencyPolicy,
  diagnostics: PromptPackDiagnostic[],
): PromptPackImportItem[] {
  const usedIds = new Set<string>();
  const sorted = [...drafts].sort((left, right) =>
    (left.numericOrder ?? Number.MAX_SAFE_INTEGER) -
    (right.numericOrder ?? Number.MAX_SAFE_INTEGER),
  );

  return sorted.map((draft, index) => {
    const fallbackId = draft.numericOrder
      ? draft.numericOrder.toFixed(3).replace(/\.000$/, "")
      : `item-${(index + 1).toString()}`;
    const id = slugify(draft.id ?? fallbackId);
    if (!id) {
      diagnostics.push({
        code: "missing_item_id",
        message: "Prompt pack item is missing an id and no stable fallback could be inferred.",
        path: draft.path ?? undefined,
        severity: "error",
      });
    }

    if (usedIds.has(id)) {
      diagnostics.push({
        code: "duplicate_item_id",
        itemId: id,
        message: `Prompt pack item id "${id}" is duplicated.`,
        path: draft.path ?? undefined,
        severity: "error",
      });
    }
    usedIds.add(id);

    if (!draft.promptBody.trim()) {
      diagnostics.push({
        code: "missing_body",
        itemId: id,
        message: `Prompt pack item "${id}" has no prompt body.`,
        path: draft.path ?? undefined,
        severity: "error",
      });
    }

    const previous = sorted[index - 1];
    const previousId = previous ? slugify(previous.id ?? "") : "";
    const suggestedDependencyIds =
      draft.dependencies.length === 0 && previousId ? [previousId] : [];
    let dependencies = draft.dependencies.map(slugify).filter(Boolean);

    if (dependencyPolicy === "hard_numeric_order" && suggestedDependencyIds.length > 0) {
      dependencies = suggestedDependencyIds;
    } else if (
      dependencyPolicy === "suggest_numeric_order" &&
      suggestedDependencyIds.length > 0
    ) {
      diagnostics.push({
        code: "numeric_dependency_suggestion",
        itemId: id,
        message: `Item "${id}" follows "${previousId}" numerically; treat that as a suggested dependency only unless the operator confirms it.`,
        path: draft.path ?? undefined,
        severity: "warning",
      });
    }

    const title = draft.title?.trim() || humanizeSlug(id);
    const metadataText = promptPackMetadataSection(pack.id, id, {
      allowedScope: draft.allowedScope,
      dependencies,
      executionWorkspace: draft.executionWorkspace,
      expectedCommitTitle: draft.expectedCommitTitle,
      forbiddenScope: draft.forbiddenScope,
      validationCommands: draft.validationCommands,
    });
    const description = [
      `Prompt pack: ${pack.name} (${pack.id})`,
      `Prompt item: ${id}`,
      draft.tags.length > 0 ? `Tags: ${draft.tags.join(", ")}` : null,
      draft.modelProfile ? `Model profile: ${draft.modelProfile}` : null,
      draft.reasoningEffort ? `Reasoning effort: ${draft.reasoningEffort}` : null,
      draft.validatorProfile ? `Validator profile: ${draft.validatorProfile}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    return {
      allowedScope: draft.allowedScope,
      dependencies,
      executionWorkspace: draft.executionWorkspace,
      expectedCommitTitle: draft.expectedCommitTitle,
      forbiddenScope: draft.forbiddenScope,
      id,
      itemType: "implementation",
      modelProfile: draft.modelProfile,
      numericOrder: draft.numericOrder,
      priority: draft.priority,
      promptBody: draft.promptBody,
      queueDraft: {
        dependencies,
        description,
        executionPolicy: "manual",
        executionWorkspace: draft.executionWorkspace ?? undefined,
        itemType: "implementation",
        priority: draft.priority,
        prompt: `${draft.promptBody}${metadataText}`,
        queueTagName: draft.tags[0],
        status: "draft",
        title,
      },
      reasoningEffort: draft.reasoningEffort,
      sourcePath: draft.path,
      suggestedDependencyIds,
      tags: draft.tags,
      title,
      validationCommands: draft.validationCommands,
      validatorProfile: draft.validatorProfile,
    };
  });
}

function validateDependencies(
  items: PromptPackImportItem[],
  diagnostics: PromptPackDiagnostic[],
) {
  const itemIds = new Set(items.map((item) => item.id));
  for (const item of items) {
    for (const dependencyId of item.dependencies) {
      if (!itemIds.has(dependencyId)) {
        diagnostics.push({
          code: "unresolved_dependency",
          itemId: item.id,
          message: `Item "${item.id}" depends on missing item "${dependencyId}".`,
          path: item.sourcePath ?? undefined,
          severity: "error",
        });
      }
    }
  }

  for (const item of items) {
    if (hasDependencyCycle(item.id, items, new Set(), new Set())) {
      diagnostics.push({
        code: "dependency_cycle",
        itemId: item.id,
        message: `Item "${item.id}" is part of a dependency cycle.`,
        path: item.sourcePath ?? undefined,
        severity: "error",
      });
    }
  }
}

function hasDependencyCycle(
  itemId: string,
  items: PromptPackImportItem[],
  visiting: Set<string>,
  visited: Set<string>,
): boolean {
  if (visiting.has(itemId)) {
    return true;
  }
  if (visited.has(itemId)) {
    return false;
  }
  visiting.add(itemId);
  const item = items.find((candidate) => candidate.id === itemId);
  const hasCycle =
    item?.dependencies.some((dependencyId) =>
      hasDependencyCycle(dependencyId, items, visiting, visited),
    ) ?? false;
  visiting.delete(itemId);
  visited.add(itemId);
  return hasCycle;
}

function arrayFromManifest(manifest: UnknownRecord | null): UnknownRecord[] {
  if (!manifest) {
    return [];
  }
  const value =
    manifest.items ?? manifest.prompts ?? manifest.tasks ?? manifest.blocks ?? [];
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value)) {
    return Object.entries(value).map(([key, raw]) =>
      isRecord(raw) ? { id: key, ...raw } : { id: key, prompt: String(raw) },
    );
  }
  return [];
}

function parsePromptHeaders(text: string): ItemDraft {
  const headers: ItemDraft = emptyDraft();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([A-Za-z][A-Za-z /_-]{1,40}):\s*(.*)$/.exec(lines[index]);
    if (!match) {
      continue;
    }
    const key = HEADER_ALIASES[normalizeHeaderKey(match[1])];
    if (!key) {
      continue;
    }
    const inlineValue = match[2].trim();
    const value =
      inlineValue ||
      collectIndentedSection(lines.slice(index + 1)).join("\n").trim();
    assignHeader(headers, key, value);
  }
  return headers;
}

function assignHeader(
  headers: ItemDraft,
  key: keyof ItemDraft,
  value: string,
) {
  if (!value) {
    return;
  }
  if (
    key === "allowedScope" ||
    key === "dependencies" ||
    key === "forbiddenScope" ||
    key === "tags" ||
    key === "validationCommands"
  ) {
    headers[key] = splitList(value);
    return;
  }
  if (key === "priority") {
    headers.priority = normalizePriority(Number.parseInt(value, 10));
    return;
  }
  if (
    key === "executionWorkspace" ||
    key === "expectedCommitTitle" ||
    key === "id" ||
    key === "modelProfile" ||
    key === "reasoningEffort" ||
    key === "validatorProfile"
  ) {
    headers[key] = value;
  }
}

function emptyDraft(): ItemDraft {
  return {
    allowedScope: [],
    dependencies: [],
    executionWorkspace: null,
    expectedCommitTitle: null,
    forbiddenScope: [],
    id: null,
    modelProfile: null,
    numericOrder: null,
    path: null,
    priority: 3,
    promptBody: "",
    reasoningEffort: null,
    tags: [],
    title: null,
    validationCommands: [],
    validatorProfile: null,
  };
}

function collectIndentedSection(lines: string[]) {
  const collected: string[] = [];
  for (const line of lines) {
    if (/^[A-Za-z][A-Za-z /_-]{1,40}:\s*/.test(line)) {
      break;
    }
    if (!line.trim() && collected.length > 0) {
      break;
    }
    if (line.trim()) {
      collected.push(line.replace(/^\s*[-*]\s*/, "").trim());
    }
  }
  return collected;
}

function splitList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeHeaderKey(key: string) {
  return key.trim().toLowerCase().replace(/[_-]+/g, " ");
}
