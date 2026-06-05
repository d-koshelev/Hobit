import type { AgentQueueTaskRunSettingsDefaults } from "./queue/agentQueueRunSettingsDefaults";
import {
  APPROVAL_POLICIES,
  PROMPT_THROUGH_QUEUE_PHRASES,
  SANDBOXES,
  hasQueueOnlyIntent,
} from "./workspaceAgentQueueCommandText";
import {
  escapeRegExp,
  isOneOf,
  stripLeadingPhrase,
  fencedPrompt,
} from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandTypes";
import { structuredCreateQueueTaskPrompt } from "./workspaceAgentQueuePromptTemplates";

export function parseBatchQueueCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  if (!isMultiTaskQueueCreateIntent(text)) {
    return null;
  }

  const taskIntents = numberedTaskIntents(text);
  if (taskIntents.length === 0) {
    return null;
  }

  const runSettings = queueRunSettingsFromText(text);
  const shouldRunAutonomous = hasRunAutonomousQueueIntent(text);
  const commands: WorkspaceAgentQueueCommand[] = taskIntents.map((intent) => {
    const structuredPrompt = structuredCreateQueueTaskPrompt(intent);

    return {
      executionPolicy: shouldRunAutonomous ? "auto" : "manual",
      prompt: structuredPrompt.prompt,
      runSettings,
      status: "queued",
      title: structuredPrompt.title,
      type: "createItem",
    };
  });

  if (shouldRunAutonomous) {
    commands.push({ type: "runAutonomousQueue" });
  }

  return {
    commands,
    forceLocal: hasQueueOnlyIntent(text),
    type: "batch",
  };
}

export function parsePromptThroughQueueCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  const body = stripLeadingPhrase(text, PROMPT_THROUGH_QUEUE_PHRASES);

  if (body === null) {
    return null;
  }

  const explicitPrompt = fencedPrompt(text);
  const sectionTask = promptThroughQueueSectionTask(body);
  const promptIntents = numberedTaskIntents(body);
  const runSettings = promptThroughQueueRunSettings(text);

  if (sectionTask) {
    return {
      commands: [
        {
          executionPolicy: "auto",
          prompt: sectionTask.prompt,
          runSettings,
          status: "queued",
          title: sectionTask.title,
          type: "createItem",
        },
        { type: "runAutonomousQueue" },
      ],
      forceLocal: true,
      type: "batch",
    };
  }

  const taskIntents =
    promptIntents.length > 0
      ? promptIntents
      : [singlePromptThroughQueueIntent(explicitPrompt ?? body)].filter(
          Boolean,
        );

  if (taskIntents.length === 0) {
    return { type: "unsupportedQueueCommand" };
  }

  const commands: WorkspaceAgentQueueCommand[] = taskIntents.map((intent) => {
    const structuredPrompt = structuredCreateQueueTaskPrompt(intent);

    return {
      executionPolicy: "auto",
      prompt: structuredPrompt.prompt,
      runSettings,
      status: "queued",
      title: structuredPrompt.title,
      type: "createItem",
    };
  });

  commands.push({ type: "runAutonomousQueue" });

  return {
    commands,
    forceLocal: true,
    type: "batch",
  };
}

function isMultiTaskQueueCreateIntent(text: string) {
  return (
    /\bcreate\s+(?:two|three|four|five|\d+)\s+(?:separate\s+)?(?:queued\s+)?(?:queue\s+)?tasks?\b/i.test(
      text,
    ) ||
    /\badd\s+these\s+tasks\s+to\s+(?:the\s+)?queue\b/i.test(text)
  );
}

function numberedTaskIntents(text: string) {
  const taskIntents: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[*-]\s+/, "").trim();
    const taskMatch =
      line.match(/^task\s+\d+\s*[:.)-]\s*(.+)$/i) ??
      line.match(/^\d+\s*[.)-]\s*(.+)$/);
    const taskIntent = taskMatch?.[1]?.trim();

    if (taskIntent) {
      taskIntents.push(taskIntent);
    }
  }

  return taskIntents;
}

function singlePromptThroughQueueIntent(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !isQueueRunSettingLine(line) &&
        !/^with\s+task-scoped\s+run\s+settings\s*:?\s*$/i.test(line),
    );

  return lines.join("\n").trim();
}

function isQueueRunSettingLine(line: string) {
  const normalized = line.replace(/^[*-]\s+/, "").trim().toLowerCase();

  return /^(?:execution\s+workspace|task\s+workspace|workspace|codex\s+executable|codex|sandbox|approval\s+policy|approval)\s*:/.test(
    normalized,
  );
}

function queueRunSettingsFromText(
  text: string,
): Partial<AgentQueueTaskRunSettingsDefaults> {
  const executionWorkspace = lineSettingValue(text, [
    "execution workspace",
    "task workspace",
    "workspace",
  ]);
  const codexExecutable = lineSettingValue(text, [
    "codex executable",
    "codex",
  ]);
  const sandbox = normalizedSandbox(lineSettingValue(text, ["sandbox"]));
  const approvalPolicy = normalizedApprovalPolicy(
    lineSettingValue(text, ["approval policy", "approval"]),
  );

  return {
    ...(approvalPolicy ? { approvalPolicy } : {}),
    ...(codexExecutable ? { codexExecutable } : {}),
    ...(executionWorkspace ? { executionWorkspace } : {}),
    ...(sandbox ? { sandbox } : {}),
  };
}

function promptThroughQueueRunSettings(
  text: string,
): Partial<AgentQueueTaskRunSettingsDefaults> {
  return queueRunSettingsFromText(text);
}

function lineSettingValue(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim().replace(/^[*-]\s+/, "").trim();

    for (const label of labels) {
      const pattern = new RegExp(
        `^${escapeRegExp(label)}\\s*:\\s*(.+)$`,
        "i",
      );
      const value = line.match(pattern)?.[1]?.trim();

      if (value) {
        return value;
      }

      const emptyLabelPattern = new RegExp(
        `^${escapeRegExp(label)}\\s*:\\s*$`,
        "i",
      );
      if (!emptyLabelPattern.test(line)) {
        continue;
      }

      for (
        let valueIndex = index + 1;
        valueIndex < lines.length;
        valueIndex += 1
      ) {
        const nextLine = lines[valueIndex]?.trim() ?? "";
        if (!nextLine) {
          continue;
        }
        if (isSettingsOrSectionLabelLine(nextLine)) {
          break;
        }
        return nextLine;
      }
    }
  }

  return "";
}

function promptThroughQueueSectionTask(text: string) {
  const prompt = labeledSectionValue(text, "prompt", []);
  if (!prompt) {
    return null;
  }

  const title =
    labeledSectionValue(text, "title", ["prompt"]) ||
    structuredCreateQueueTaskPrompt(prompt).title;

  return {
    prompt,
    title,
  };
}

function labeledSectionValue(
  text: string,
  label: string,
  stopLabels: string[],
) {
  const lines = text.split(/\r?\n/);
  const labelPattern = new RegExp(`^${escapeRegExp(label)}\\s*:\\s*(.*)$`, "i");
  const stopPatterns = stopLabels.map(
    (stopLabel) =>
      new RegExp(`^${escapeRegExp(stopLabel)}\\s*:`, "i"),
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    const match = line.match(labelPattern);
    if (!match) {
      continue;
    }

    const collected: string[] = [];
    const inlineValue = match[1]?.trim() ?? "";
    if (inlineValue) {
      collected.push(inlineValue);
    }

    for (
      let valueIndex = index + 1;
      valueIndex < lines.length;
      valueIndex += 1
    ) {
      const nextLine = lines[valueIndex] ?? "";
      const trimmed = nextLine.trim();
      if (stopPatterns.some((pattern) => pattern.test(trimmed))) {
        break;
      }
      collected.push(nextLine);
    }

    return collected.join("\n").trim();
  }

  return "";
}

function isSettingsOrSectionLabelLine(line: string) {
  const normalized = line.replace(/^[*-]\s+/, "").trim().toLowerCase();
  return /^(?:execution\s+workspace|task\s+workspace|workspace|codex\s+executable|codex|sandbox|approval\s+policy|approval|title|prompt)\s*:/.test(
    normalized,
  );
}

function normalizedSandbox(value: string) {
  const normalized = value.trim().toLowerCase();
  return isOneOf(normalized, SANDBOXES) ? normalized : null;
}

function normalizedApprovalPolicy(value: string) {
  const normalized = value.trim().toLowerCase();
  return isOneOf(normalized, APPROVAL_POLICIES) ? normalized : null;
}

function hasRunAutonomousQueueIntent(text: string) {
  return /\b(?:run|start)\s+autonomous\s+queue\b/i.test(text);
}
