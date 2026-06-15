import type {
  AgentQueueTaskStatus,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import { startsWithAnyPhrase } from "./workspaceAgentQueueCommandUtils";

export const CREATE_PHRASES = [
  "add example queue items to queue",
  "add example queue items to the queue",
  "create example queue items",
  "create queue items",
  "create queue item",
  "create queue task",
  "create a queue task",
  "create tasks in agent queue",
  "create queued queue task",
  "create queued task",
  "create queued tasks",
  "create queued queue tasks",
  "create tasks",
  "create queue tasks",
  "create separate queued queue tasks",
  "create separate queued tasks",
  "add queue task",
  "add queue tasks",
  "add tasks to queue",
  "add tasks to the queue",
  "add these tasks to queue",
  "add these tasks to the queue",
  "make queue items from this",
  "create task",
  "\u0441\u043e\u0437\u0434\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443",
  "\u0434\u043e\u0431\u0430\u0432\u044c \u0437\u0430\u0434\u0430\u0447\u0443",
  "\u0434\u043e\u0431\u0430\u0432\u044c task",
];

export const ANALYZE_PHRASES = [
  "analyze queue",
  "show queue",
  "what is in queue",
  "what should run next",
  "\u043f\u0440\u043e\u0430\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u0439 \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
  "\u0447\u0442\u043e \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
];

export const RUN_AUTONOMOUS_PHRASES = [
  "run autonomous queue",
  "start autonomous queue",
  "run queue",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u0430\u0432\u0442\u043e\u043d\u043e\u043c\u043d\u0443\u044e \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 autonomous",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
];

export const PROMPT_THROUGH_QUEUE_PHRASES = [
  "run this prompt through queue",
  "run these prompts through queue",
  "execute this prompt through queue",
  "execute these prompts through queue",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u044d\u0442\u043e\u0442 \u043f\u0440\u043e\u043c\u043f\u0442 \u0447\u0435\u0440\u0435\u0437 queue",
  "\u0432\u044b\u043f\u043e\u043b\u043d\u0438 \u044d\u0442\u0438 \u043f\u0440\u043e\u043c\u043f\u0442\u044b \u0447\u0435\u0440\u0435\u0437 queue",
  "\u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u043f\u0440\u043e\u043c\u043f\u0442\u044b \u0447\u0435\u0440\u0435\u0437 \u043e\u0447\u0435\u0440\u0435\u0434\u044c",
  "\u0441\u043e\u0437\u0434\u0430\u0439 \u0438 \u0437\u0430\u043f\u0443\u0441\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0438",
];

export const STOP_AUTONOMOUS_PHRASES = [
  "stop autonomous queue",
  "stop after current task",
  "\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438 \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u043f\u043e\u0441\u043b\u0435 \u0442\u0435\u043a\u0443\u0449\u0435\u0439",
  "\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u0438 \u043f\u043e\u0441\u043b\u0435 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0437\u0430\u0434\u0430\u0447\u0438",
];

export const UPDATE_STATUSES: AgentQueueTaskStatus[] = [
  "draft",
  "queued",
  "ready",
  "running",
  "completed",
  "failed",
  "cancelled",
  "review_needed",
];

export const SANDBOXES: DirectWorkSandbox[] = [
  "danger_full_access",
  "read_only",
  "workspace_write",
];

export const APPROVAL_POLICIES: DirectWorkApprovalPolicy[] = [
  "never",
  "on_request",
  "untrusted",
];

const FAILURE_EXPLANATION_PATTERNS = [
  /\bwhy\s+(?:it|this|that|the\s+(?:queue\s+)?task)\s+failed\b/i,
  /\bwhy\s+did\s+(?:it|this|that|the\s+(?:queue\s+)?task)\s+fail\b/i,
  /\bexplain\s+(?:this\s+)?failure\b/i,
  /\bwhat\s+failed\b/i,
  /\bwhy\s+failed\b/i,
  /\bwhy\s+(?:\u0437\u0430\u0434\u0430\u0447\u0430|task)\s+failed\b/i,
  /\u043f\u043e\u0447\u0435\u043c\u0443\s+\u0443\u043f\u0430\u043b\u043e/i,
  /\u043f\u043e\u0447\u0435\u043c\u0443\s+\u043e\u0448\u0438\u0431\u043a\u0430/i,
  /\u043e\u0431\u044a\u044f\u0441\u043d\u0438\s+\u043e\u0448\u0438\u0431\u043a\u0443/i,
  /\u043f\u043e\u0447\u0435\u043c\u0443\s+\u0437\u0430\u0434\u0430\u0447\u0430\s+failed/i,
  /\u043f\u043e\u0447\u0435\u043c\u0443\s+task\s+failed/i,
];

const QUEUE_ONLY_PATTERNS = [
  /\buse\s+agent\s+queue\s+only\b/i,
  /\bqueue\s+only\b/i,
];

const QUEUE_CONTROL_PATTERNS = [
  /\badd\s+example\s+queue\s+items?\s+to\s+(?:the\s+)?queue\b/i,
  /\bcreate\s+queue\s+items?\b/i,
  /\bcreate\s+(?:\w+\s+){0,4}(?:queued\s+)?(?:queue\s+)?tasks?\b/i,
  /\badd\s+(?:these\s+)?tasks?\s+to\s+(?:the\s+)?queue\b/i,
  /\b(?:run|execute)\s+th(?:is|ese)\s+prompts?\s+through\s+queue\b/i,
  /\banalyze\s+queue\b/i,
  /\brun\s+autonomous\s+queue\b/i,
  /\bstart\s+autonomous\s+queue\b/i,
  /\bupdate\s+task\s+\S+/i,
];

export function hasQueueOnlyIntent(text: string) {
  return QUEUE_ONLY_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasQueueControlIntent(text: string) {
  return QUEUE_CONTROL_PATTERNS.some((pattern) => pattern.test(text));
}

export function isFailureExplanationIntent(text: string) {
  return FAILURE_EXPLANATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function embeddedQueueCommandText(text: string) {
  const lowerText = text.toLowerCase();
  const phraseIndexes = [
    ...CREATE_PHRASES,
    ...ANALYZE_PHRASES,
    ...PROMPT_THROUGH_QUEUE_PHRASES,
    ...RUN_AUTONOMOUS_PHRASES,
    ...STOP_AUTONOMOUS_PHRASES,
  ]
    .map((phrase) => lowerText.indexOf(phrase))
    .filter((index) => index > 0)
    .sort((left, right) => left - right);
  const firstIndex = phraseIndexes[0];

  return firstIndex === undefined ? "" : text.slice(firstIndex).trim();
}

export function startsWithAnyKnownQueuePhrase(text: string) {
  return startsWithAnyPhrase(text, [
    ...CREATE_PHRASES,
    ...ANALYZE_PHRASES,
    ...PROMPT_THROUGH_QUEUE_PHRASES,
    ...RUN_AUTONOMOUS_PHRASES,
    ...STOP_AUTONOMOUS_PHRASES,
  ]);
}
