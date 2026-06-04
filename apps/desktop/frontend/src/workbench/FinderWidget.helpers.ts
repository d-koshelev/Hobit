import type {
  GitFileChange,
  GitFileDiff,
  GitLog,
  GitRepositoryStatus,
} from "../workspace/types";
import { formatKnowledgeGenerationSourceRefs } from "./workspaceAgentQueuePromptTemplates";

const MAX_DIRECTORY_ENTRIES = 200;
const MAX_FILE_PREVIEW_BYTES = 100 * 1024;
const MAX_GIT_DIFF_ATTACHMENT_CHARS = 6_000;

export type FinderEntryKind = "directory" | "file";

export type FinderWritableFile = {
  close: () => Promise<void> | void;
  write: (content: string) => Promise<void> | void;
};

export type FinderFileHandle = {
  createWritable?: () => Promise<FinderWritableFile>;
  getFile?: () => Promise<File>;
  kind: "file";
  name: string;
};

export type FinderDirectoryHandle = {
  entries?: () => AsyncIterableIterator<[string, FinderHandle]>;
  kind: "directory";
  name: string;
  values?: () => AsyncIterableIterator<FinderHandle>;
};

export type FinderHandle = FinderDirectoryHandle | FinderFileHandle;

export type FinderEntry = {
  handle: FinderHandle;
  kind: FinderEntryKind;
  name: string;
  pathSegments: string[];
};

export type FinderColumn = {
  capped: boolean;
  entries: FinderEntry[];
  error: string | null;
  handle: FinderDirectoryHandle;
  loading: boolean;
  pathSegments: string[];
};

export type FinderSelectedItem = {
  handle: FinderHandle;
  kind: FinderEntryKind;
  name: string;
  pathSegments: string[];
};

export type FinderRootState = {
  gitRoot: string | null;
  handle: FinderDirectoryHandle | null;
  label: string;
  listingAvailable: boolean;
};

export type FinderPreviewPaneState =
  | "hidden"
  | "minimized"
  | "normal"
  | "maximized";

export type FinderPaneState = "minimized" | "normal" | "maximized";

export type FinderPaneId = "columns" | "git" | "commit" | "history";

export type FinderPaneStates = Record<FinderPaneId, FinderPaneState>;

export type FinderViewMode = "all" | "changed";

export type FinderPreviewMode = "content" | "git";

export type FinderFilePreview = {
  canEdit: boolean;
  capped: boolean;
  content: string;
  draft: string;
  editMode: boolean;
  error: string | null;
  handle: FinderFileHandle;
  loading: boolean;
  name: string;
  path: string;
  savedMessage: string | null;
  saving: boolean;
  sizeBytes: number | null;
};

export type FinderGitStatusState = {
  error: string | null;
  loading: boolean;
  status: GitRepositoryStatus | null;
};

export type FinderGitDiffPreviewState = {
  attachedMessage: string | null;
  diff: GitFileDiff | null;
  error: string | null;
  loading: boolean;
  path: string | null;
};

export type FinderGitHistoryState = {
  error: string | null;
  loading: boolean;
  log: GitLog | null;
  selectedHash: string | null;
};

export type FinderCommitCandidate = {
  areas: string[];
  kinds: string[];
  path: string;
};

export function buildFinderCommitCandidates(
  files: GitFileChange[],
): FinderCommitCandidate[] {
  const candidates = new Map<string, FinderCommitCandidate>();

  for (const file of files) {
    if (!isSafeRepoRelativeFilePath(file.path)) {
      continue;
    }

    const existingCandidate = candidates.get(file.path);

    if (existingCandidate) {
      addUnique(existingCandidate.areas, file.area);
      addUnique(existingCandidate.kinds, file.kind);
      continue;
    }

    candidates.set(file.path, {
      areas: [file.area],
      kinds: [file.kind],
      path: file.path,
    });
  }

  return Array.from(candidates.values());
}

export function buildFinderCommitMessage(title: string, body: string) {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();

  return trimmedBody ? `${trimmedTitle}\n\n${trimmedBody}` : trimmedTitle;
}

export function getFinderGitPushBlocker(
  repositoryRoot: string | null,
  status: GitRepositoryStatus | null,
) {
  if (!repositoryRoot) {
    return "Push requires an approved local root path.";
  }

  if (!status?.branch) {
    return "Push requires a loaded Git branch snapshot.";
  }

  if (status.branch.isDetached) {
    return "Push is blocked while HEAD is detached.";
  }

  if (!status.branch.name) {
    return "Push is blocked because the branch name is unknown.";
  }

  if (!status.branch.upstream) {
    return "Push is blocked because upstream is unknown.";
  }

  const behind = status.branch.behind ?? 0;
  if (behind > 0) {
    return `Push is blocked because the branch is behind upstream by ${behind}.`;
  }

  const ahead = status.branch.ahead ?? 0;
  if (ahead === 0) {
    return "Push is blocked because there are no local commits ahead of upstream.";
  }

  return null;
}

export function formatGitCount(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : "0";
}

export async function readDirectoryEntries(
  directoryHandle: FinderDirectoryHandle,
  pathSegments: string[],
) {
  const handles: FinderHandle[] = [];
  let capped = false;

  for await (const handle of iterateDirectoryHandles(directoryHandle)) {
    handles.push(handle);
    if (handles.length > MAX_DIRECTORY_ENTRIES) {
      capped = true;
      handles.pop();
      break;
    }
  }

  const entries = handles
    .map((handle) => ({
      handle,
      kind: handle.kind,
      name: handle.name,
      pathSegments: [...pathSegments, handle.name],
    }))
    .sort(compareFinderEntries);

  return { capped, entries };
}

export async function loadFilePreview(fileHandle: FinderFileHandle) {
  if (!fileHandle.getFile) {
    throw new Error("File preview is unavailable in this runtime.");
  }

  const file = await fileHandle.getFile();
  const capped = file.size > MAX_FILE_PREVIEW_BYTES;
  const previewBlob = capped ? file.slice(0, MAX_FILE_PREVIEW_BYTES) : file;
  const content = await previewBlob.text();

  if (content.includes("\u0000")) {
    throw new Error("Binary file preview is unsupported.");
  }

  return {
    canEdit: !capped && typeof fileHandle.createWritable === "function",
    capped,
    content,
    error: capped
      ? "Preview is capped; editing is disabled for this file."
      : null,
    sizeBytes: file.size,
  };
}

export function hasDirtyPreview(preview: FinderFilePreview | null) {
  return Boolean(preview?.editMode && preview.draft !== preview.content);
}

export function getFinderKnowledgeTaskBlocker({
  filePreview,
  onCreateAgentQueueTask,
  selectedItem,
}: {
  filePreview: FinderFilePreview | null;
  onCreateAgentQueueTask: unknown;
  selectedItem: FinderSelectedItem | null;
}) {
  if (!onCreateAgentQueueTask) {
    return "Queue task creation is unavailable in this runtime.";
  }

  if (!selectedItem) {
    return "Select a file or folder to create a Knowledge Queue task.";
  }

  if (selectedItem.kind === "directory") {
    return null;
  }

  const selectedPath = selectedItem.pathSegments.join("/");
  if (!filePreview || filePreview.path !== selectedPath) {
    return "Wait for the selected file preview before creating a Knowledge task.";
  }

  if (filePreview.loading) {
    return "Selected file preview is still loading.";
  }

  if (filePreview.capped) {
    return "The selected file is oversized for direct source import. Select its folder for Queue analysis or choose a smaller text file.";
  }

  if (filePreview.error) {
    return `The selected file is not supported for direct source import: ${filePreview.error}`;
  }

  return null;
}

export function finderKnowledgeQueueTaskRequest({
  rootLabel,
  selectedItem,
}: {
  rootLabel: string;
  selectedItem: FinderSelectedItem;
}) {
  const sourcePath = selectedItem.pathSegments.join("/");
  const sourceType = selectedItem.kind === "directory" ? "folder" : "file";
  const sourceRef = `${sourceType}: ${sourcePath}`;
  const structuredSourceRefs = formatKnowledgeGenerationSourceRefs([
    {
      caps: [
        "Approved root is a scope boundary, not permission to scan everything",
        "Use only selected Finder refs",
      ],
      kind: "codebase",
      label: "Finder approved root",
      reason: "Bound the selected Finder source to the operator-approved root.",
      scope: "workspace-local",
      selector: rootLabel,
      warnings: [
        "Current Queue task API has no durable sourceRefs field; these structured refs are embedded in the prompt only.",
      ],
    },
    {
      caps: [
        selectedItem.kind === "directory"
          ? "Selected folder only; report a blocker if it is too broad"
          : "Selected file only",
        "No unrelated folder reads or unselected file reads",
      ],
      kind: "codebase",
      label: `Finder selected ${sourceType}`,
      path: sourcePath,
      reason: "Generate draft Knowledge from the explicit Finder selection.",
      scope: "workspace-local",
      selector: sourceRef,
      warnings: [
        "Current Queue task API has no durable sourceRefs field; these structured refs are embedded in the prompt only.",
      ],
    },
  ]);

  return {
    description: `Generate draft Knowledge from selected Finder ${sourceType}: ${sourcePath}. Draft output only; do not activate Knowledge.`,
    executionPolicy: "manual" as const,
    priority: 0,
    prompt: [
      "Mode:",
      "Queue knowledge generation task.",
      "",
      "Task type:",
      "knowledge_generation",
      "",
      "Workflow:",
      "Create Knowledge from Finder selection.",
      "",
      "Objective:",
      "Generate a draft Knowledge pack from the explicitly selected Finder source.",
      "",
      "Selected source refs:",
      `* Finder approved root: ${rootLabel}`,
      `* codebase ${sourceRef}`,
      "",
      structuredSourceRefs,
      "",
      "Desired draft Knowledge pack:",
      "",
      "* source-attributed overview",
      "* important files, folders, interfaces, and boundaries",
      "* safe modification rules",
      "* relevant validation commands to consider later",
      "* proposed Knowledge item titles, types, tags, and workspace-local scope",
      "* blockers, uncertainty, stale source risks, or missing source refs",
      "",
      "Source rules:",
      "",
      "* Use only the listed Finder source refs and explicit operator-provided context.",
      "* Do not read unrelated folders or unselected files.",
      "* If the selected folder is too broad, report a blocker instead of broadening scope.",
      "* If more source is needed, list the missing source refs instead of inventing context.",
      "",
      "Draft Knowledge rules:",
      "",
      "* Return draft Knowledge only.",
      "* Do not create, edit, enable, or activate Knowledge records.",
      "* Do not mutate Notes, files, Git, Queue, Executor, Terminal, JDBC, or workspace state.",
      "* Do not run commands unless a later explicit Queue execution task asks for them.",
      "* Default suggested scope to workspace-local unless the operator explicitly chose another target.",
      "",
      "Report:",
      "",
      "* status",
      "* draft pack summary",
      "* proposed items with quick summary, full content outline, suggested type, tags, scope, confidence, and source refs",
      "* blockers or omitted unsupported content",
      "* confirmation that no Knowledge was activated",
    ].join("\n"),
    queueTagName: "Knowledge generation",
    status: "queued" as const,
    title: `Generate ${sourceType} Knowledge: ${compactFinderTitle(sourcePath)}`,
    validationStatus: "not_started" as const,
  };
}

export function formatPreviewSize(sizeBytes: number | null) {
  if (sizeBytes === null) {
    return "Size unavailable";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${Math.ceil(sizeBytes / 1024)} KB`;
}

export function compareFinderEntries(first: FinderEntry, second: FinderEntry) {
  if (first.kind !== second.kind) {
    return first.kind === "directory" ? -1 : 1;
  }

  return first.name.localeCompare(second.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function finderEntryKindLabel(kind: FinderEntryKind) {
  return kind === "directory" ? "Folder" : "File";
}

export function buildGitChangeByPath(changedFiles: GitFileChange[]) {
  const changesByPath = new Map<string, GitFileChange>();

  for (const file of changedFiles) {
    changesByPath.set(normalizeFinderPath(file.path), file);
    if (file.originalPath) {
      changesByPath.set(normalizeFinderPath(file.originalPath), file);
    }
  }

  return changesByPath;
}

export function changeForEntry(
  entry: FinderEntry,
  changeByPath: Map<string, GitFileChange>,
  changedFiles: GitFileChange[],
) {
  const entryPath = normalizeFinderPath(entry.pathSegments.join("/"));
  const exactChange = changeByPath.get(entryPath);

  if (exactChange) {
    return exactChange;
  }

  if (entry.kind !== "directory") {
    return null;
  }

  const directoryPrefix = `${entryPath}/`;

  return (
    changedFiles.find((file) =>
      normalizeFinderPath(file.path).startsWith(directoryPrefix),
    ) ?? null
  );
}

export function entryMatchesChangedFilter(
  entry: FinderEntry,
  changedFiles: GitFileChange[],
) {
  const entryPath = normalizeFinderPath(entry.pathSegments.join("/"));

  if (entry.kind === "file") {
    return changedFiles.some(
      (file) =>
        normalizeFinderPath(file.path) === entryPath ||
        (file.originalPath
          ? normalizeFinderPath(file.originalPath) === entryPath
          : false),
    );
  }

  const directoryPrefix = `${entryPath}/`;

  return changedFiles.some((file) => {
    const filePath = normalizeFinderPath(file.path);
    const originalPath = file.originalPath
      ? normalizeFinderPath(file.originalPath)
      : null;

    return (
      filePath.startsWith(directoryPrefix) ||
      Boolean(originalPath?.startsWith(directoryPrefix))
    );
  });
}

export function normalizeFinderPath(path: string) {
  return path.split("\\").join("/");
}

export function finderGitStatusMarker(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "untracked":
      return "U";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "conflicted":
      return "!";
    case "modified":
      return "M";
    default:
      return "?";
  }
}

export function finderGitKindLabel(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "Added";
    case "deleted":
      return "Deleted";
    case "modified":
      return "Modified";
    case "renamed":
      return "Renamed";
    case "copied":
      return "Copied";
    case "untracked":
      return "Untracked";
    case "conflicted":
      return "Conflicted";
    default:
      return "Unknown";
  }
}

export function finderGitAreaLabel(area: string) {
  switch (area.toLowerCase()) {
    case "staged":
      return "Staged";
    case "unstaged":
      return "Unstaged";
    case "untracked":
      return "Untracked";
    default:
      return "Unknown";
  }
}

export function finderGitBadgeVariant(kind: string) {
  switch (kind.toLowerCase()) {
    case "added":
      return "success";
    case "conflicted":
      return "error";
    case "deleted":
    case "untracked":
      return "warning";
    case "modified":
    case "renamed":
    case "copied":
      return "info";
    default:
      return "neutral";
  }
}

export function finderGitDiffContextText({
  change,
  diff,
  rootLabel,
}: {
  change: GitFileChange | null;
  diff: GitFileDiff;
  rootLabel: string;
}) {
  const patch = diff.patch ?? diff.errorMessage ?? "No patch preview returned.";
  const patchExcerpt = truncateText(patch, MAX_GIT_DIFF_ATTACHMENT_CHARS);

  return [
    "Finder selected-file Git diff",
    `Root: ${rootLabel}`,
    `Path: ${diff.path}`,
    `Diff status: ${diff.status}`,
    change
      ? `Change: ${finderGitKindLabel(change.kind)} / ${finderGitAreaLabel(
          change.area,
        )}`
      : "Change: unknown",
    `Patch capped by backend: ${diff.patchTruncated ? "yes" : "no"}`,
    "Patch preview:",
    patchExcerpt,
  ].join("\n");
}

export function errorToReadableMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function addUnique(items: string[], item: string) {
  if (!items.includes(item)) {
    items.push(item);
  }
}

function isSafeRepoRelativeFilePath(path: string) {
  const normalizedPath = path.split("\\").join("/");

  if (!path || path.trim() !== path || path.includes("\0")) {
    return false;
  }

  if (
    path.startsWith("-") ||
    path.startsWith(":") ||
    path.startsWith("/") ||
    path.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(path)
  ) {
    return false;
  }

  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.endsWith("/") ||
    normalizedPath.startsWith("../") ||
    normalizedPath.includes("/../") ||
    normalizedPath.includes("/./")
  ) {
    return false;
  }

  return !/[?*[\]]/.test(path);
}

async function* iterateDirectoryHandles(directoryHandle: FinderDirectoryHandle) {
  if (directoryHandle.values) {
    for await (const handle of directoryHandle.values()) {
      yield handle;
    }
    return;
  }

  if (directoryHandle.entries) {
    for await (const [, handle] of directoryHandle.entries()) {
      yield handle;
    }
    return;
  }

  throw new Error("Directory entries are unavailable in this runtime.");
}

function compactFinderTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 48
    ? normalized
    : `${normalized.slice(0, 47).trim()}...`;
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n[Finder diff attachment capped]`;
}
