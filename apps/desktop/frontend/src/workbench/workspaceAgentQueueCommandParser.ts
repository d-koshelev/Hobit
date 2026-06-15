import { parseBatchQueueCommand } from "./workspaceAgentQueueBatchCommands";
import {
  ANALYZE_PHRASES,
  CREATE_PHRASES,
  RUN_AUTONOMOUS_PHRASES,
  STOP_AUTONOMOUS_PHRASES,
  embeddedQueueCommandText,
  hasQueueControlIntent,
  hasQueueOnlyIntent,
  isFailureExplanationIntent,
  startsWithAnyKnownQueuePhrase,
} from "./workspaceAgentQueueCommandText";
import {
  fencedPrompt,
  firstSentence,
  startsWithAnyPhrase,
  stripFenceBlocks,
  stripLeadingPhrase,
} from "./workspaceAgentQueueCommandUtils";
import type { WorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandTypes";
import { parsePromptThroughQueueCommand } from "./workspaceAgentQueueBatchCommands";
import { parseUpdateCommand } from "./workspaceAgentQueueUpdateCommands";
import {
  codebaseKnowledgeGenerationQueueTaskPrompt,
  historyKnowledgeGenerationQueueTaskPrompt,
  structuredCreateQueueTaskPrompt,
} from "./workspaceAgentQueuePromptTemplates";

const CODEBASE_KNOWLEDGE_GENERATION_PATTERNS = [
  /\b(?:create|generate|draft|prepare)\s+(?:draft\s+)?(?:codebase\s+)?knowledge\b/i,
  /\bknowledge\s+(?:about|for|from)\s+(?:the\s+)?(?:codebase|codebase\s+area|code|module|folder|directory|path)\b/i,
  /\b(?:create|generate|draft|prepare)\s+(?:a\s+)?(?:queue\s+)?task\s+(?:to|for)\s+(?:create|generate|draft|prepare)\s+(?:draft\s+)?(?:codebase\s+)?knowledge\b/i,
];

const HISTORY_KNOWLEDGE_GENERATION_PATTERNS = [
  /\b(?:create|generate|draft|prepare)\s+(?:draft\s+)?knowledge\s+from\s+(?:recent\s+)?(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue|history)\s*(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)?\b/i,
  /\bsummar(?:ize|ise)\s+(?:recent\s+)?(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue)\s+(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)\s+into\s+(?:draft\s+)?knowledge\b/i,
  /\b(?:coordinator|workspace\s+agent|agent|command|terminal|run|executor|queue)\s+(?:history|transcript|summar(?:y|ies)|reports?|excerpts?)\s+(?:to|into)\s+(?:draft\s+)?knowledge\b/i,
];

export function parseWorkspaceAgentQueueCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  const visibleText = text.trim();

  if (!visibleText) {
    return null;
  }

  const batchCommand = parseBatchQueueCommand(visibleText);
  if (batchCommand) {
    return batchCommand;
  }

  const promptThroughQueueCommand = parsePromptThroughQueueCommand(visibleText);
  if (promptThroughQueueCommand) {
    return promptThroughQueueCommand;
  }

  const visibleNonFencedText = stripFenceBlocks(visibleText);

  if (isHistoryKnowledgeGenerationIntent(visibleNonFencedText)) {
    const draft = historyKnowledgeGenerationQueueTaskPrompt(visibleNonFencedText);

    return {
      description: draft.description,
      executionPolicy: "manual",
      prompt: draft.prompt,
      queueTagName: "Knowledge generation",
      status: "queued",
      title: draft.title,
      type: "createItem",
    };
  }

  if (isCodebaseKnowledgeGenerationIntent(visibleNonFencedText)) {
    const draft =
      codebaseKnowledgeGenerationQueueTaskPrompt(visibleNonFencedText);

    return {
      description: draft.description,
      executionPolicy: "manual",
      prompt: draft.prompt,
      queueTagName: "Knowledge generation",
      status: "queued",
      title: draft.title,
      type: "createItem",
    };
  }

  if (!startsWithAnyKnownQueuePhrase(visibleText)) {
    const embeddedCommandText = embeddedQueueCommandText(visibleNonFencedText);
    if (embeddedCommandText) {
      const embeddedCommand =
        parseWorkspaceAgentQueueCommand(embeddedCommandText);
      if (embeddedCommand) {
        return embeddedCommand;
      }
    }
  }

  if (startsWithAnyPhrase(visibleText, ANALYZE_PHRASES)) {
    return { type: "analyzeQueue" };
  }

  if (isFailureExplanationIntent(visibleText)) {
    return { type: "explainFailure" };
  }

  if (startsWithAnyPhrase(visibleText, RUN_AUTONOMOUS_PHRASES)) {
    return { type: "runAutonomousQueue" };
  }

  if (startsWithAnyPhrase(visibleText, STOP_AUTONOMOUS_PHRASES)) {
    return { type: "stopAutonomousQueueAfterCurrent" };
  }

  if (isQueueCreationIntentMissingContent(visibleText)) {
    return {
      reason: "missing_task_content",
      type: "queueCreationNeedsInput",
    };
  }

  const createBody = stripLeadingPhrase(visibleText, CREATE_PHRASES);
  if (createBody !== null) {
    if (!stripFenceBlocks(createBody).trim() && !fencedPrompt(visibleText)) {
      return {
        reason: "missing_task_content",
        type: "queueCreationNeedsInput",
      };
    }

    const explicitPrompt = fencedPrompt(visibleText);
    const createPrompt = explicitPrompt
      ? {
          prompt: explicitPrompt,
          title:
            firstSentence(stripFenceBlocks(createBody)) ||
            "Workspace Agent task",
        }
      : structuredCreateQueueTaskPrompt(createBody);

    return {
      prompt: createPrompt.prompt,
      title: createPrompt.title,
      type: "createItem",
    };
  }

  return (
    parseUpdateCommand(visibleText) ??
    forcedLocalQueueCommand(visibleNonFencedText)
  );
}

function isCodebaseKnowledgeGenerationIntent(text: string) {
  return CODEBASE_KNOWLEDGE_GENERATION_PATTERNS.some((pattern) =>
    pattern.test(text),
  );
}

function isHistoryKnowledgeGenerationIntent(text: string) {
  return HISTORY_KNOWLEDGE_GENERATION_PATTERNS.some((pattern) =>
    pattern.test(text),
  );
}

function isQueueCreationIntentMissingContent(text: string) {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");

  return [
    "add tasks to queue",
    "add tasks to the queue",
    "break this into queue tasks",
    "create a queue task",
    "create queue items",
    "create queue item",
    "create queue task",
    "create queue tasks",
    "create tasks in agent queue",
    "make queue items from this",
  ].includes(normalized);
}

function forcedLocalQueueCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  return hasQueueOnlyIntent(text) || hasQueueControlIntent(text)
    ? { type: "unsupportedQueueCommand" }
    : null;
}
