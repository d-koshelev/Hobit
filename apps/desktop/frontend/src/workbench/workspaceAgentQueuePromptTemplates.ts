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
