import type {
  AgentQueueExecutionPlanPreview,
  AgentQueueExecutionPlanPreviewLevel,
  AgentQueueTask,
} from "../../workspace/types";
import {
  displayTaskTitle,
  normalizeItemType,
  normalizeTaskDependencies,
} from "../agentQueueTaskUiModel";

export type BuildAgentQueueExecutionPlanPreviewInput = {
  generatedAt?: string;
  task: AgentQueueTask;
  workerId?: string | null;
};

const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";

export function buildAgentQueueExecutionPlanPreview({
  generatedAt = new Date().toISOString(),
  task,
  workerId,
}: BuildAgentQueueExecutionPlanPreviewInput): AgentQueueExecutionPlanPreview {
  const text = planInputText(task);
  const normalizedText = text.toLowerCase();
  const itemType = normalizeItemType(task.itemType);
  const wordCount = words(text).length;
  const lineCount = text.split(/\r?\n/).filter((line) => line.trim()).length;
  const likelyFilesOrAreas = inferLikelyFilesOrAreas(text);
  const expectedValidationCommands = inferValidationCommands(text, itemType);
  const keywordScore = [
    keywordHit(normalizedText, /\b(schema|migration|sqlite|database|storage|dto|tauri|rust)\b/g),
    keywordHit(normalizedText, /\b(ui|frontend|css|react|tsx|component|panel|sidebar)\b/g),
    keywordHit(normalizedText, /\b(test|tests|typecheck|build|validation|cargo|npm|vitest)\b/g),
    keywordHit(normalizedText, /\b(runtime|executor|scheduler|worker|codex|terminal|command)\b/g),
    keywordHit(normalizedText, /\b(docs?|contract|architecture|readme)\b/g),
  ].reduce((sum, value) => sum + value, 0);
  const independentGoalCount = inferIndependentGoalCount(text);
  const dependencyCount = normalizeTaskDependencies(task.dependsOn).length;
  const complexity = complexityLevel({
    dependencyCount,
    independentGoalCount,
    keywordScore,
    likelyFileCount: likelyFilesOrAreas.length,
    lineCount,
    validationCommandCount: expectedValidationCommands.length,
    wordCount,
  });
  const risk = riskLevel({
    complexity,
    dependencyCount,
    itemType,
    keywordScore,
    text: normalizedText,
    validationCommandCount: expectedValidationCommands.length,
  });
  const splitRecommendation = splitRecommendationFor({
    complexity,
    dependencyCount,
    independentGoalCount,
    keywordScore,
    likelyFileCount: likelyFilesOrAreas.length,
    risk,
    validationCommandCount: expectedValidationCommands.length,
    wordCount,
  });
  const tokenEstimate = estimateTokens({
    complexity,
    likelyFileCount: likelyFilesOrAreas.length,
    validationCommandCount: expectedValidationCommands.length,
    wordCount,
  });
  const minuteEstimate = estimateMinutes({
    complexity,
    itemType,
    likelyFileCount: likelyFilesOrAreas.length,
    validationCommandCount: expectedValidationCommands.length,
  });

  return {
    complexity,
    estimatedMinutesMax: minuteEstimate.max,
    estimatedMinutesMin: minuteEstimate.min,
    estimatedTokenMax: tokenEstimate.max,
    estimatedTokenMin: tokenEstimate.min,
    expectedValidationCommands,
    generatedAt,
    itemId: task.queueItemId,
    likelyFilesOrAreas,
    notes:
      "Local deterministic estimate only. It does not call a provider and does not start execution.",
    planId: `plan-${task.queueItemId}-${stableHash([
      task.queueItemId,
      workerId ?? "unassigned",
      task.title,
      task.description,
      task.prompt,
      itemType,
      normalizeTaskDependencies(task.dependsOn).join(","),
    ].join("\n"))}`,
    risk,
    source: "heuristic",
    splitRecommendation,
    status: splitRecommendation ? "needs_split" : "planned",
    steps: inferPlanSteps(task, likelyFilesOrAreas, expectedValidationCommands),
    workerId: workerId?.trim() || "unassigned",
  };
}

export function staleExecutionPlanPreview(
  plan: AgentQueueExecutionPlanPreview,
  options?: { workerId?: string | null },
): AgentQueueExecutionPlanPreview {
  return {
    ...plan,
    status: "stale",
    workerId: options?.workerId?.trim() || plan.workerId,
  };
}

export function executionPlanStatusLabel(
  plan: AgentQueueExecutionPlanPreview | null | undefined,
) {
  if (!plan) {
    return "Plan needed";
  }

  switch (plan.status) {
    case "needs_split":
      return "Split advised";
    case "planned":
      return "Plan ready";
    case "stale":
      return "Plan stale";
    case "not_planned":
    default:
      return "Plan needed";
  }
}

export function executionPlanBadgeVariant(
  plan: AgentQueueExecutionPlanPreview | null | undefined,
) {
  if (!plan || plan.status === "not_planned") {
    return "neutral" as const;
  }

  if (plan.status === "needs_split" || plan.status === "stale") {
    return "warning" as const;
  }

  return "success" as const;
}

export function executionPlanEstimateText(
  plan: AgentQueueExecutionPlanPreview,
) {
  return `Approx. ${plan.estimatedTokenMin.toLocaleString()}-${plan.estimatedTokenMax.toLocaleString()} tokens, ${plan.estimatedMinutesMin.toString()}-${plan.estimatedMinutesMax.toString()} min`;
}

function planInputText(task: AgentQueueTask) {
  return [task.title, task.description, task.prompt].filter(Boolean).join("\n");
}

function inferPlanSteps(
  task: AgentQueueTask,
  likelyFilesOrAreas: string[],
  expectedValidationCommands: string[],
) {
  const itemType = normalizeItemType(task.itemType);
  const title = displayTaskTitle(task);

  if (itemType === "diff_review") {
    return [
      `Review the provided diff or changed-work context for ${title}.`,
      "Identify behavior, safety, contract, and test risks.",
      "Summarize required follow-ups without mutating files.",
    ];
  }

  if (itemType === "validation") {
    return [
      `Confirm the validation target for ${title}.`,
      "Run or review the expected validation commands when execution is explicitly started later.",
      "Report pass/fail signals and any unresolved blockers.",
    ];
  }

  if (itemType === "follow_up") {
    return [
      `Inspect the follow-up scope for ${title}.`,
      "Make the smallest targeted change that addresses the follow-up.",
      "Verify the changed behavior with focused validation.",
    ];
  }

  return [
    `Inspect the current implementation and contracts for ${title}.`,
    likelyFilesOrAreas.length > 0
      ? "Update the likely touched areas with focused code or docs changes."
      : "Identify the smallest relevant files before making changes.",
    expectedValidationCommands.length > 0
      ? "Run the expected validation commands after implementation."
      : "Run focused validation appropriate to the changed layer.",
  ];
}

function inferLikelyFilesOrAreas(text: string) {
  const matches = new Set<string>();
  const pathPattern =
    /(?:[\w.-]+[\\/])+(?:[\w.-]+)(?:\.[A-Za-z0-9]+)?|(?:docs|apps|crates|scripts)[\\/][^\s,;:)"']+/g;

  for (const match of text.match(pathPattern) ?? []) {
    matches.add(match.replace(/[),.;]+$/, ""));
  }

  const lowered = text.toLowerCase();
  const areas: Array<[RegExp, string]> = [
    [/\b(frontend|react|component|tsx|css|ui|panel|sidebar)\b/, "frontend UI"],
    [/\b(test|tests|vitest|typecheck|build)\b/, "frontend tests/validation"],
    [/\b(rust|cargo|tauri|command|dto)\b/, "desktop/Rust boundary"],
    [/\b(storage|sqlite|schema|migration|database)\b/, "storage/model boundary"],
    [/\b(docs?|contract|architecture)\b/, "docs/contracts"],
    [/\b(queue|worker|scheduler|routing|autorun)\b/, "Agent Queue model/UI"],
  ];

  for (const [pattern, area] of areas) {
    if (pattern.test(lowered)) {
      matches.add(area);
    }
  }

  return Array.from(matches).slice(0, 10);
}

function inferValidationCommands(text: string, itemType: AgentQueueTask["itemType"]) {
  const commandMatches = new Set<string>();
  const commandPattern =
    /\b(?:npm\.cmd run (?:typecheck|test|build) --prefix apps\/desktop\/frontend|npm run (?:typecheck|test|build)|cargo (?:fmt --all|check --workspace|test --workspace)|git diff --check)\b/g;

  for (const match of text.match(commandPattern) ?? []) {
    commandMatches.add(match.trim().replace(/[.;]+$/, ""));
  }

  const lowered = text.toLowerCase();
  if (commandMatches.size === 0) {
    if (itemType === "validation") {
      commandMatches.add("npm.cmd run test --prefix apps/desktop/frontend");
    }
    if (/\b(typecheck|typescript)\b/.test(lowered)) {
      commandMatches.add("npm.cmd run typecheck --prefix apps/desktop/frontend");
    }
    if (/\b(build|vite)\b/.test(lowered)) {
      commandMatches.add("npm.cmd run build --prefix apps/desktop/frontend");
    }
    if (/\b(rust|cargo)\b/.test(lowered)) {
      commandMatches.add("cargo check --workspace");
    }
    if (/\b(test|tests|vitest)\b/.test(lowered)) {
      commandMatches.add("npm.cmd run test --prefix apps/desktop/frontend");
    }
  }

  return Array.from(commandMatches).slice(0, 8);
}

function estimateTokens({
  complexity,
  likelyFileCount,
  validationCommandCount,
  wordCount,
}: {
  complexity: AgentQueueExecutionPlanPreviewLevel;
  likelyFileCount: number;
  validationCommandCount: number;
  wordCount: number;
}) {
  const complexityBase = complexity === "high" ? 7000 : complexity === "medium" ? 3500 : 1400;
  const min = roundEstimate(
    complexityBase + wordCount * 5 + likelyFileCount * 240 + validationCommandCount * 180,
    100,
  );
  const spread = complexity === "high" ? 1.9 : complexity === "medium" ? 1.65 : 1.45;

  return {
    max: Math.min(64000, roundEstimate(min * spread, 100)),
    min: Math.max(500, Math.min(48000, min)),
  };
}

function estimateMinutes({
  complexity,
  itemType,
  likelyFileCount,
  validationCommandCount,
}: {
  complexity: AgentQueueExecutionPlanPreviewLevel;
  itemType: AgentQueueTask["itemType"];
  likelyFileCount: number;
  validationCommandCount: number;
}) {
  const base =
    itemType === "diff_review"
      ? 8
      : itemType === "validation"
        ? 6
        : complexity === "high"
          ? 35
          : complexity === "medium"
            ? 18
            : 8;
  const min = Math.max(3, base + Math.min(likelyFileCount, 8) * 2);
  const max =
    min +
    (complexity === "high" ? 40 : complexity === "medium" ? 22 : 10) +
    validationCommandCount * 4;

  return { max: Math.min(240, max), min: Math.min(180, min) };
}

function complexityLevel({
  dependencyCount,
  independentGoalCount,
  keywordScore,
  likelyFileCount,
  lineCount,
  validationCommandCount,
  wordCount,
}: {
  dependencyCount: number;
  independentGoalCount: number;
  keywordScore: number;
  likelyFileCount: number;
  lineCount: number;
  validationCommandCount: number;
  wordCount: number;
}) {
  const score =
    wordCount / 180 +
    lineCount / 18 +
    likelyFileCount * 0.45 +
    validationCommandCount * 0.55 +
    independentGoalCount * 0.8 +
    dependencyCount * 0.7 +
    keywordScore * 0.8;

  if (score >= 10 || wordCount > 900 || likelyFileCount >= 7) {
    return "high";
  }

  if (score >= 4 || wordCount > 280 || likelyFileCount >= 3) {
    return "medium";
  }

  return "low";
}

function riskLevel({
  complexity,
  dependencyCount,
  itemType,
  keywordScore,
  text,
  validationCommandCount,
}: {
  complexity: AgentQueueExecutionPlanPreviewLevel;
  dependencyCount: number;
  itemType: AgentQueueTask["itemType"];
  keywordScore: number;
  text: string;
  validationCommandCount: number;
}) {
  if (
    complexity === "high" ||
    /\b(schema|migration|runtime|executor|scheduler|codex|tauri|storage|rollback)\b/.test(
      text,
    ) ||
    dependencyCount >= 3
  ) {
    return "high";
  }

  if (
    complexity === "medium" ||
    itemType === "diff_review" ||
    validationCommandCount >= 2 ||
    keywordScore >= 3
  ) {
    return "medium";
  }

  return "low";
}

function splitRecommendationFor({
  complexity,
  dependencyCount,
  independentGoalCount,
  keywordScore,
  likelyFileCount,
  risk,
  validationCommandCount,
  wordCount,
}: {
  complexity: AgentQueueExecutionPlanPreviewLevel;
  dependencyCount: number;
  independentGoalCount: number;
  keywordScore: number;
  likelyFileCount: number;
  risk: AgentQueueExecutionPlanPreviewLevel;
  validationCommandCount: number;
  wordCount: number;
}) {
  if (
    wordCount > 900 ||
    independentGoalCount >= 5 ||
    likelyFileCount >= 8 ||
    (complexity === "high" && risk === "high" && keywordScore >= 4) ||
    (validationCommandCount >= 5 && dependencyCount >= 2)
  ) {
    return "Split into smaller queue sub-blocks before execution. Keep model/docs, UI, runtime/storage, and validation follow-up in separate items where possible.";
  }

  return undefined;
}

function inferIndependentGoalCount(text: string) {
  const headingCount = (text.match(/^\s*(?:#{1,3}|\d+[.)]|[-*])\s+/gm) ?? [])
    .length;
  const taskWordCount = (text.match(/\b(task|goal|block|step|required)\b/gi) ?? [])
    .length;

  return Math.max(1, Math.min(10, headingCount + Math.floor(taskWordCount / 3)));
}

function keywordHit(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length > 0 ? 1 : 0;
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function roundEstimate(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function notPlannedExecutionPlanPreview(
  task: AgentQueueTask,
): AgentQueueExecutionPlanPreview {
  return {
    complexity: "low",
    estimatedMinutesMax: 0,
    estimatedMinutesMin: 0,
    estimatedTokenMax: 0,
    estimatedTokenMin: 0,
    expectedValidationCommands: [],
    generatedAt: DEFAULT_GENERATED_AT,
    itemId: task.queueItemId,
    likelyFilesOrAreas: [],
    planId: `plan-${task.queueItemId}-not-planned`,
    risk: "low",
    source: "heuristic",
    status: "not_planned",
    steps: [],
    workerId: "unassigned",
  };
}
