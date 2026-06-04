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
  structuredCreateQueueTaskPrompt,
} from "./workspaceAgentQueuePromptTemplates";

const CODEBASE_KNOWLEDGE_GENERATION_PATTERNS = [
  /\b(?:create|generate|draft|prepare)\s+(?:draft\s+)?(?:codebase\s+)?knowledge\b/i,
  /\bknowledge\s+(?:about|for|from)\s+(?:the\s+)?(?:codebase|codebase\s+area|code|module|folder|directory|path)\b/i,
  /\b(?:create|generate|draft|prepare)\s+(?:a\s+)?(?:queue\s+)?task\s+(?:to|for)\s+(?:create|generate|draft|prepare)\s+(?:draft\s+)?(?:codebase\s+)?knowledge\b/i,
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

  const createBody = stripLeadingPhrase(visibleText, CREATE_PHRASES);
  if (createBody !== null) {
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

function forcedLocalQueueCommand(
  text: string,
): WorkspaceAgentQueueCommand | null {
  return hasQueueOnlyIntent(text) || hasQueueControlIntent(text)
    ? { type: "unsupportedQueueCommand" }
    : null;
}
