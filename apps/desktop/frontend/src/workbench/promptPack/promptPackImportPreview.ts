import type {
  PromptPackDependencyGraphSummary,
  PromptPackDiagnostic,
  PromptPackFileEntry,
  PromptPackImportItem,
  PromptPackImportPlan,
  PromptPackImportPreviewModel,
  PromptPackImportValidation,
  PromptPackModelRoute,
  PromptPackSourceAdapterStatus,
} from "./promptPackModel";
import { parsePromptPackImportPlan } from "./promptPackParser";

export const PROMPT_PACK_UNAVAILABLE_SOURCE_ADAPTER: PromptPackSourceAdapterStatus = {
  kind: "unavailable",
  label: "Local prompt-pack import unavailable",
  message:
    "No safe prompt-pack folder or zip reader is wired. Preview can only use explicit in-memory parser entries supplied by this surface.",
};

export const PROMPT_PACK_IN_MEMORY_SOURCE_ADAPTER: PromptPackSourceAdapterStatus = {
  kind: "available",
  label: "In-memory prompt-pack entries",
  message:
    "Preview is built from explicit text entries already supplied to the prompt-pack parser. No Queue items are created by preview.",
};

export type BuildPromptPackImportPreviewOptions = {
  selectedItemIds?: readonly string[];
  sourceAdapter?: PromptPackSourceAdapterStatus;
};

export function buildPromptPackImportPreview(
  plan: PromptPackImportPlan,
  options: BuildPromptPackImportPreviewOptions = {},
): PromptPackImportPreviewModel {
  const orderedItems = stablePromptPackItems(plan.items);
  const selectedIdSet =
    options.selectedItemIds === undefined
      ? new Set(orderedItems.map((item) => item.id))
      : new Set(options.selectedItemIds);
  const selectedItems = orderedItems.filter((item) => selectedIdSet.has(item.id));
  const selectedItemIds = selectedItems.map((item) => item.id);
  const unselectedItems = orderedItems.filter((item) => !selectedIdSet.has(item.id));
  const validation = validatePromptPackImportPlan(plan, { selectedItemIds });
  const unresolvedDependencies = validation.blockingErrors.filter(
    (diagnostic) =>
      diagnostic.code === "unresolved_dependency" ||
      diagnostic.code === "unselected_dependency",
  );

  return {
    dependencyGraphSummary: buildDependencyGraphSummary(orderedItems, selectedItemIds),
    errors: validation.blockingErrors,
    expectedCommitTitles: uniqueSorted(
      selectedItems
        .map((item) => item.expectedCommitTitle)
        .filter((title): title is string => Boolean(title?.trim())),
    ),
    importAvailable: validation.canImport,
    itemCount: orderedItems.length,
    modelRouting: buildModelRouting(selectedItems),
    pack: plan.pack,
    selectedItemIds,
    selectedItems,
    sourceAdapter: options.sourceAdapter ?? PROMPT_PACK_IN_MEMORY_SOURCE_ADAPTER,
    unselectedItems,
    unresolvedDependencies,
    validationCommands: uniqueSorted(
      selectedItems.flatMap((item) => item.validationCommands),
    ),
    warnings: validation.warnings,
  };
}

export function promptPackPreviewFromSourceText(
  sourceText: string,
): PromptPackImportPreviewModel | null {
  const trimmed = sourceText.trim();
  if (!trimmed) {
    return null;
  }

  return buildPromptPackImportPreview(
    parsePromptPackImportPlan([promptPackFileEntryFromSourceText(trimmed)]),
    {
      sourceAdapter: PROMPT_PACK_IN_MEMORY_SOURCE_ADAPTER,
    },
  );
}

function promptPackFileEntryFromSourceText(text: string): PromptPackFileEntry {
  const path = text.startsWith("{") || text.startsWith("[")
    ? "prompt-batch.json"
    : "001-pasted-prompt.md";

  return {
    path,
    source: "unknown",
    text,
  };
}

export function validatePromptPackImportPlan(
  plan: PromptPackImportPlan,
  options: { selectedItemIds?: readonly string[] } = {},
): PromptPackImportValidation {
  const orderedItems = stablePromptPackItems(plan.items);
  const selectedIdSet =
    options.selectedItemIds === undefined
      ? new Set(orderedItems.map((item) => item.id))
      : new Set(options.selectedItemIds);
  const selectedItems = orderedItems.filter((item) => selectedIdSet.has(item.id));
  const blockingErrors = [...plan.errors];
  const itemIds = new Set(orderedItems.map((item) => item.id));

  if (orderedItems.length > 0 && selectedItems.length === 0) {
    blockingErrors.push({
      code: "no_selected_items",
      message: "Select at least one prompt-pack item before importing.",
      severity: "error",
    });
  }

  for (const item of selectedItems) {
    for (const dependencyId of item.dependencies) {
      if (!itemIds.has(dependencyId)) {
        continue;
      }
      if (!selectedIdSet.has(dependencyId)) {
        blockingErrors.push({
          code: "unselected_dependency",
          itemId: item.id,
          message: `Selected item "${item.id}" depends on unselected item "${dependencyId}".`,
          path: item.sourcePath ?? undefined,
          severity: "error",
        });
      }
    }
  }

  return {
    blockingErrors: sortDiagnostics(blockingErrors),
    canImport: blockingErrors.length === 0,
    warnings: sortDiagnostics(plan.warnings),
  };
}

function buildDependencyGraphSummary(
  items: readonly PromptPackImportItem[],
  selectedItemIds: readonly string[],
): PromptPackDependencyGraphSummary {
  const itemIds = new Set(items.map((item) => item.id));
  const selectedIdSet = new Set(selectedItemIds);
  const selectedItems = items.filter((item) => selectedIdSet.has(item.id));
  const edgeCount = items.reduce(
    (count, item) =>
      count + item.dependencies.filter((dependencyId) => itemIds.has(dependencyId)).length,
    0,
  );
  const unresolvedDependencyCount = items.reduce(
    (count, item) =>
      count + item.dependencies.filter((dependencyId) => !itemIds.has(dependencyId)).length,
    0,
  );
  const dependedOnIds = new Set(items.flatMap((item) => item.dependencies));
  const blockedSelectedItemCount = selectedItems.filter((item) =>
    item.dependencies.some((dependencyId) => !selectedIdSet.has(dependencyId)),
  ).length;

  return {
    blockedSelectedItemCount,
    edgeCount,
    hasCycles: items.some((item) => hasCycle(item.id, items, new Set(), new Set())),
    leafItemCount: items.filter((item) => !dependedOnIds.has(item.id)).length,
    maxDepth: items.reduce(
      (maxDepth, item) => Math.max(maxDepth, dependencyDepth(item.id, items, new Set())),
      0,
    ),
    rootItemCount: items.filter((item) => item.dependencies.length === 0).length,
    selectedItemCount: selectedItems.length,
    totalItemCount: items.length,
    unresolvedDependencyCount,
  };
}

function buildModelRouting(
  selectedItems: readonly PromptPackImportItem[],
): PromptPackModelRoute[] {
  const routes = new Map<string, PromptPackModelRoute>();

  for (const item of selectedItems) {
    const modelProfile = item.modelProfile ?? "default";
    const reasoningEffort = item.reasoningEffort ?? "default";
    const validatorProfile = item.validatorProfile ?? "default";
    const key = `${modelProfile}\u0000${reasoningEffort}\u0000${validatorProfile}`;
    const route =
      routes.get(key) ??
      {
        itemIds: [],
        modelProfile,
        reasoningEffort,
        validatorProfile,
      };
    route.itemIds.push(item.id);
    routes.set(key, route);
  }

  return [...routes.values()].sort((left, right) =>
    routeLabel(left).localeCompare(routeLabel(right)),
  );
}

function routeLabel(route: PromptPackModelRoute) {
  return `${route.modelProfile}/${route.reasoningEffort}/${route.validatorProfile}`;
}

function dependencyDepth(
  itemId: string,
  items: readonly PromptPackImportItem[],
  seen: Set<string>,
): number {
  if (seen.has(itemId)) {
    return 0;
  }
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return 0;
  }
  seen.add(itemId);
  const depth =
    item.dependencies.length === 0
      ? 1
      : 1 +
        Math.max(
          0,
          ...item.dependencies.map((dependencyId) =>
            dependencyDepth(dependencyId, items, new Set(seen)),
          ),
        );
  seen.delete(itemId);
  return depth;
}

function hasCycle(
  itemId: string,
  items: readonly PromptPackImportItem[],
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
  const cycle =
    item?.dependencies.some((dependencyId) =>
      hasCycle(dependencyId, items, visiting, visited),
    ) ?? false;
  visiting.delete(itemId);
  visited.add(itemId);
  return cycle;
}

function stablePromptPackItems(items: readonly PromptPackImportItem[]) {
  return [...items].sort((left, right) => {
    const numeric =
      (left.numericOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.numericOrder ?? Number.MAX_SAFE_INTEGER);
    if (numeric !== 0) {
      return numeric;
    }
    return left.id.localeCompare(right.id);
  });
}

function sortDiagnostics(diagnostics: readonly PromptPackDiagnostic[]) {
  return [...diagnostics].sort(
    (left, right) =>
      severityRank(left.severity) - severityRank(right.severity) ||
      (left.path ?? "").localeCompare(right.path ?? "") ||
      (left.itemId ?? "").localeCompare(right.itemId ?? "") ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}

function severityRank(severity: PromptPackDiagnostic["severity"]) {
  return severity === "error" ? 0 : 1;
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}
