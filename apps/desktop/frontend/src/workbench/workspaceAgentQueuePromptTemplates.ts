export function structuredCreateQueueTaskPrompt(rawIntent: string) {
  const normalizedIntent = normalizeCreateTaskIntent(rawIntent);

  if (isReadAgentsFirstLineIntent(normalizedIntent)) {
    return knownReadOnlyPrompt({
      command: "Get-Content .\\AGENTS.md -TotalCount 1",
      objective: "Read the first line of AGENTS.md.",
      reportItems: [
        "AGENTS.md first line",
        "confirmation that no files were changed",
      ],
      title: "Read AGENTS.md first line",
    });
  }

  if (isShowLocationIntent(normalizedIntent)) {
    return knownReadOnlyPrompt({
      command: "Get-Location",
      objective: "Show the current execution location.",
      reportItems: [
        "current location",
        "confirmation that no files were changed",
      ],
      title: "Show current location",
    });
  }

  if (isGitStatusIntent(normalizedIntent)) {
    return knownReadOnlyPrompt({
      command: "git status --short --branch",
      objective: "Show the current Git status.",
      reportItems: [
        "git status summary",
        "confirmation that no files were changed",
      ],
      title: "Show git status",
    });
  }

  const objective = rawIntent.trim() || "Create a Workspace Agent Queue task.";
  const safetyBoundaries = explicitEditIntent(objective)
    ? [
        "Stay within the explicit objective.",
        "Do not commit, push, reset, clean, stash, or rollback.",
      ]
    : [
        "Do not edit files.",
        "Do not create files.",
        "Do not delete files.",
        "Do not commit, push, reset, clean, stash, or rollback.",
      ];

  return {
    prompt: [
      "Mode:",
      "Queue executor task.",
      "",
      "Objective:",
      objective,
      "",
      ...safetyBoundaries,
      "",
      "Report:",
      "",
      "* status",
      "* changes made, or confirmation that no files were changed",
      "* validation status only if explicitly requested or already present",
      "* risks or blockers",
    ].join("\n"),
    title: "Workspace Agent task",
  };
}

export function codebaseKnowledgeGenerationQueueTaskPrompt(rawIntent: string) {
  const area = selectedCodebaseArea(rawIntent);
  const sourceRef = area || "the explicitly selected codebase area";

  return {
    description: `Generate draft Knowledge from selected codebase area: ${sourceRef}. Draft output only; do not activate Knowledge.`,
    prompt: [
      "Mode:",
      "Queue knowledge generation task.",
      "",
      "Objective:",
      "Generate a draft Knowledge pack from the explicitly selected codebase area.",
      "",
      "Selected source refs:",
      `* codebase: ${sourceRef}`,
      "",
      "Required output:",
      "",
      "* architecture overview",
      "* important files and why they matter",
      "* key flows and boundaries",
      "* safe modification rules",
      "* relevant validation commands",
      "* quick summaries for review surfaces",
      "* proposed Knowledge item types, tags, and scope",
      "* blockers, uncertainty, stale source risks, or missing source refs",
      "",
      "Draft Knowledge rules:",
      "",
      "* Return draft Knowledge only.",
      "* Do not create, edit, enable, or activate Knowledge records.",
      "* Do not mutate Notes, files, Git, Queue, Executor, Terminal, JDBC, or workspace state.",
      "* Use only the selected source refs and explicit operator-provided context.",
      "* Do not recursively scan unrelated folders or read unselected files.",
      "* If the selected area is ambiguous or too broad, report a blocker instead of broadening scope.",
      "* Preserve source attribution with related files and source refs.",
      "* Default suggested scope to workspace-local unless the prompt explicitly says otherwise.",
      "",
      "Suggested draft item types:",
      "",
      "* codebase_knowledge",
      "* architecture_decision",
      "* validation_rule",
      "* known_issue",
      "* workflow",
      "* skill",
      "",
      "Report:",
      "",
      "* status",
      "* draft pack summary",
      "* proposed items with quick summary, full content outline, suggested type, tags, scope, confidence, and source refs",
      "* validation commands to run later, without running them unless explicitly required by the task",
      "* confirmation that no Knowledge was activated",
    ].join("\n"),
    title: area
      ? `Generate codebase Knowledge: ${compactTitle(area)}`
      : "Generate codebase Knowledge draft",
  };
}

function explicitEditIntent(value: string) {
  return /\b(?:edit|modify|change|update)\s+(?:the\s+)?(?:file|files|code|implementation)\b/i.test(
    value,
  );
}

function knownReadOnlyPrompt({
  command,
  objective,
  reportItems,
  title,
}: {
  command: string;
  objective: string;
  reportItems: string[];
  title: string;
}) {
  return {
    prompt: [
      "Mode:",
      "Read-only command task.",
      "",
      "Objective:",
      objective,
      "",
      "Run only:",
      "",
      `* ${command}`,
      "",
      "Do not edit files.",
      "Do not create files.",
      "Do not delete files.",
      "Do not commit, push, reset, clean, stash, or rollback.",
      "",
      "Report:",
      "",
      ...reportItems.map((item) => `* ${item}`),
    ].join("\n"),
    title,
  };
}

function normalizeCreateTaskIntent(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function isReadAgentsFirstLineIntent(value: string) {
  return (
    /^read\s+agents\.md\s+first\s+line$/.test(value) ||
    /^read\s+first\s+line\s+(?:of\s+)?agents\.md$/.test(value)
  );
}

function isShowLocationIntent(value: string) {
  return /^(?:show|get)\s+(?:current\s+)?location$/.test(value);
}

function isGitStatusIntent(value: string) {
  return /^(?:(?:show|get)\s+)?git\s+status$/.test(value);
}

function selectedCodebaseArea(value: string) {
  const labeledArea = labeledAreaValue(value);
  if (labeledArea) {
    return labeledArea;
  }

  const match = value.match(
    /\b(?:about|for|from|in)\s+(?:the\s+)?(?:codebase\s+area|codebase|code|module|folder|directory|path)?\s*[:=-]?\s*([\s\S]+)$/i,
  );
  const area = match?.[1]?.trim() ?? "";

  return stripTrailingPunctuation(area);
}

function labeledAreaValue(value: string) {
  for (const label of [
    "codebase area",
    "selected area",
    "area",
    "path",
    "folder",
    "directory",
    "module",
    "source",
  ]) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(label)}\\s*[:=]\\s*(?:"([^"]+)"|'([^']+)'|([^\\n;]+))`,
      "i",
    );
    const match = value.match(pattern);
    const area = match?.[1] ?? match?.[2] ?? match?.[3];

    if (area?.trim()) {
      return stripTrailingPunctuation(area.trim());
    }
  }

  return "";
}

function compactTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 48
    ? normalized
    : `${normalized.slice(0, 47).trim()}...`;
}

function stripTrailingPunctuation(value: string) {
  return value.trim().replace(/[.!?]+$/g, "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
