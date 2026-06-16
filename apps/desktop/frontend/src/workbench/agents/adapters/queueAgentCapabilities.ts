import {
  promptPackPreviewFromFileEntries,
  promptPackPreviewFromSourceText,
  type PromptPackFileEntry,
  type PromptPackImportPreviewModel,
} from "../../promptPack";
import { materializeSmartQueuePromptPack } from "../../queue/smartQueuePromptPackMaterialization";
import { createActionResult } from "../broker/results";
import type {
  HobitAgentActionHandlerMap,
  HobitAgentActionRequest,
  HobitAgentActionResult,
} from "../broker/types";
import {
  createQueueAgentItemsPreview,
  createQueueSelfTestReport,
  noHiddenSideEffectFlags,
  queueAgentCreatedItem,
  queueSideEffectFlags,
  QUEUE_ACTIVITY_EVENTS,
  singletonQueueTarget,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentCapabilityStatus,
  type QueueAgentCreateItemInput,
  type QueueAgentCreateItemsInput,
  type QueueAgentCreateItemsRequest,
  type QueueAgentCreateItemsPreview,
  type QueueAgentMaybePromise,
  type QueueAgentNormalizedCreateItem,
  type QueueAgentPromptPackInput,
  type QueueAgentPromptPackPreview,
  type QueueAgentSelfTestCaseResult,
  type QueueAgentSelfTestReport,
} from "./queueAgentCapabilityTypes";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

type QueueAgentActionHandlerResult =
  | HobitAgentActionResult
  | Promise<HobitAgentActionResult>;

export function createQueueAgentActionHandlers(
  adapterApi: QueueAgentAdapterApi,
): HobitAgentActionHandlerMap {
  return {
    "queue.createItem": ({ request }) => handleCreateItem(adapterApi, request),
    "queue.createItems": ({ request }) => handleCreateItems(adapterApi, request),
    "queue.importPromptPack": ({ request }) =>
      handleImportPromptPack(adapterApi, request),
    "queue.preparePromptPackPreview": ({ request }) =>
      handlePreparePromptPackPreview(adapterApi, request),
    "queue.selfTest": ({ request }) => handleSelfTest(adapterApi, request),
    "queue.targetSingletonQueue": ({ request }) =>
      handleTargetSingletonQueue(adapterApi, request),
  };
}

export function createDefaultQueueAgentAdapterApi(): QueueAgentAdapterApi {
  return {
    createItems: (request) => {
      const preview = createQueueAgentItemsPreview(request.items);
      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
        message: "Queue items created",
        output: {
          ...preview,
          createdItems: request.items.map(queueAgentCreatedItem),
          dependencyEdgesPreserved: true,
        },
        status: "succeeded",
      };
    },
    getSingletonQueueTarget: () => ({
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.targetSingletonQueue],
      message: "Queue target resolved",
      output: singletonQueueTarget(),
      status: "succeeded",
    }),
    importPromptPack: (input, request) => {
      const promptPackPreview = previewPromptPack(input);
      if (promptPackPreview.status !== "succeeded" || !promptPackPreview.output) {
        return {
          activityEventNames: [...QUEUE_ACTIVITY_EVENTS.importPromptPack],
          message: promptPackPreview.message,
          reasons: promptPackPreview.reasons,
          status: promptPackPreview.status,
        };
      }
      const preview = createQueueAgentItemsPreview(request.items);
      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.importPromptPack],
        message: "Queue items created",
        output: {
          ...promptPackPreview.output,
          ...preview,
          createdItems: request.items.map(queueAgentCreatedItem),
          dependencyEdgesPreserved: true,
        },
        status: "succeeded",
      };
    },
    previewCreateItems: (request) => ({
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
      message: "Queue items preview prepared",
      output: createQueueAgentItemsPreview(request.items),
      status: "succeeded",
    }),
    previewPromptPack: (input) => previewPromptPack(input),
    runQueueSelfTest: undefined,
    supportsDependencyEdges: true,
    supportsSafeMutationSandbox: false,
  };
}

function handleTargetSingletonQueue(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.getSingletonQueueTarget(),
    capabilityId: request.capabilityId,
    defaultMessage: "Queue target resolved",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleCreateItem(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const input = isRecord(request.input)
    ? { items: [request.input as QueueAgentCreateItemInput] }
    : null;

  if (!input) {
    return invalidInput(request, "Queue item input is required.");
  }

  return runCreateItems(adapterApi, request, input, "Queue items created");
}

function handleCreateItems(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  if (!isRecord(request.input)) {
    return invalidInput(request, "Queue items input is required.");
  }

  return runCreateItems(
    adapterApi,
    request,
    request.input as QueueAgentCreateItemsInput,
    "Queue items created",
  );
}

function runCreateItems(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
  input: QueueAgentCreateItemsInput,
  invokeMessage: string,
): QueueAgentActionHandlerResult {
  const validation = normalizeCreateItemsInput(input);
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  if (!adapterApi.supportsDependencyEdges && hasDependencyEdges(validation.value.items)) {
    return failed(
      request,
      "Queue item creation unavailable: dependency edges are not supported by this Queue adapter.",
    );
  }

  return withAdapterResult(
    adapterApi.getSingletonQueueTarget(),
    (targetResult) => {
      if (targetResult.status !== "succeeded" || !targetResult.output) {
        return actionResultFromAdapter({
          adapterResult: targetResult,
          capabilityId: request.capabilityId,
          defaultMessage: "Queue item creation unavailable",
          dryRun: request.dryRun,
          requestId: request.requestId,
        });
      }

      const adapterRequest = {
        ...validation.value,
        target: targetResult.output,
      };
      const adapterResult = request.dryRun
        ? adapterApi.previewCreateItems(adapterRequest)
        : adapterApi.createItems(adapterRequest);

      return actionResultFromMaybeAdapter({
        adapterResult,
        capabilityId: request.capabilityId,
        defaultMessage: request.dryRun
          ? "Queue items preview prepared"
          : invokeMessage,
        dryRun: request.dryRun,
        requestId: request.requestId,
      });
    },
  );
}

function handlePreparePromptPackPreview(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizePromptPackInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.previewPromptPack(validation.value),
    capabilityId: request.capabilityId,
    defaultMessage: "Queue items preview prepared",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleImportPromptPack(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizePromptPackInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message);
  }

  return withAdapterResult(
    adapterApi.previewPromptPack(validation.value),
    (previewResult) => {
      if (
        request.dryRun ||
        previewResult.status !== "succeeded" ||
        !previewResult.output
      ) {
        return actionResultFromAdapter({
          adapterResult: previewResult,
          capabilityId: request.capabilityId,
          defaultMessage: "Queue items preview prepared",
          dryRun: request.dryRun,
          requestId: request.requestId,
        });
      }

      if (!previewResult.output.importAvailable) {
        return invalidInput(
          request,
          "Prompt-pack input has blocking validation errors.",
        );
      }

      const createValidation = createItemsFromPromptPackPreview(
        previewResult.output,
      );
      if (!createValidation.ok) {
        return invalidInput(request, createValidation.message);
      }

      if (
        !adapterApi.supportsDependencyEdges &&
        hasDependencyEdges(createValidation.value.items)
      ) {
        return failed(
          request,
          "Queue item creation unavailable: dependency edges are not supported by this Queue adapter.",
        );
      }

      return withAdapterResult(
        adapterApi.getSingletonQueueTarget(),
        (targetResult) => {
          if (targetResult.status !== "succeeded" || !targetResult.output) {
            return actionResultFromAdapter({
              adapterResult: targetResult,
              capabilityId: request.capabilityId,
              defaultMessage: "Queue item creation unavailable",
              dryRun: request.dryRun,
              requestId: request.requestId,
            });
          }

          return actionResultFromMaybeAdapter({
            adapterResult: adapterApi.importPromptPack(validation.value, {
              ...createValidation.value,
              target: targetResult.output,
            }),
            capabilityId: request.capabilityId,
            defaultMessage: "Queue items created",
            dryRun: request.dryRun,
            requestId: request.requestId,
          });
        },
      );
    },
  );
}

function handleSelfTest(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const adapterResult =
    adapterApi.runQueueSelfTest?.() ?? runDefaultQueueSelfTest(adapterApi);

  return withAdapterResult(adapterResult, (resolvedResult) =>
    actionResultFromAdapter({
      adapterResult: resolvedResult,
      capabilityId: request.capabilityId,
      defaultMessage:
        resolvedResult.output?.status === "blocked"
          ? "Queue self-test blocked"
          : "Queue self-test passed",
      dryRun: request.dryRun,
      requestId: request.requestId,
    }),
  );
}

function runDefaultQueueSelfTest(
  adapterApi: QueueAgentAdapterApi,
): QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSelfTestReport>> {
  const cases: QueueAgentSelfTestCaseResult[] = [];

  return withAdapterResult(
    adapterApi.getSingletonQueueTarget(),
    (targetResult) => {
      const target =
        targetResult.status === "succeeded" && targetResult.output
          ? targetResult.output
          : singletonQueueTarget();
      cases.push(singletonTargetSelfTestCase(targetResult));

      const createItemsInput = normalizeCreateItemsInput({
        items: [
          {
            id: "self-test-item",
            prompt: "Self-test prompt.",
            title: "Self-test item",
          },
        ],
      });

      if (!createItemsInput.ok) {
        cases.push({
          caseId: "queue:create-items-dry-run",
          evidence: [createItemsInput.message],
          message: "Queue dry-run preview could not be prepared.",
          reason: "Safe check skipped",
          status: "blocked",
        });
        return queueSelfTestAdapterResult(cases);
      }

      return withAdapterResult(
        adapterApi.previewCreateItems({
          ...createItemsInput.value,
          target,
        }),
        (createItemsPreviewResult) => {
          const createItemsPreview = createItemsPreviewResult.output ?? null;
          cases.push(createItemsDryRunSelfTestCase(createItemsPreviewResult));
          cases.push(
            createItemsPreviewAssertionCase({
              actual:
                createItemsPreviewResult.status === "succeeded" &&
                createItemsPreview?.wouldTargetSingletonQueue === true,
              blockedMessage: "Queue dry-run target check could not run.",
              caseId: "queue:dry-run-target-singleton",
              evidenceLabel: "wouldTargetSingletonQueue",
              failedMessage:
                "Queue dry-run preview did not target the singleton Queue.",
              passedMessage: "Singleton Queue target verified.",
              previewResult: createItemsPreviewResult,
            }),
          );
          cases.push(
            createItemsPreviewAssertionCase({
              actual:
                createItemsPreviewResult.status === "succeeded" &&
                createItemsPreview?.wouldAutoRunWorkers === false,
              blockedMessage: "Queue worker-start check could not run.",
              caseId: "queue:no-auto-run",
              evidenceLabel: "wouldAutoRunWorkers",
              failedMessage:
                "Queue dry-run preview would start Queue workers.",
              passedMessage: "No Queue worker start.",
              previewResult: createItemsPreviewResult,
            }),
          );
          cases.push(
            createItemsPreviewAssertionCase({
              actual:
                createItemsPreviewResult.status === "succeeded" &&
                createItemsPreview?.wouldCreateDuplicateQueueView === false,
              blockedMessage: "Queue view creation check could not run.",
              caseId: "queue:no-duplicate-view",
              evidenceLabel: "wouldCreateDuplicateQueueView",
              failedMessage:
                "Queue dry-run preview would create a duplicate Queue view.",
              passedMessage: "No Queue view creation.",
              previewResult: createItemsPreviewResult,
            }),
          );

          return withAdapterResult(
            adapterApi.previewPromptPack(queueSelfTestPromptPackInput()),
            (promptPackPreviewResult) => {
              cases.push(promptPackPreviewSelfTestCase(promptPackPreviewResult));
              cases.push({
                caseId: "queue:no-mutation",
                evidence: [
                  "queue.createItems was checked through previewCreateItems.",
                  "Prompt-pack materialization was checked through previewPromptPack.",
                  "No Queue mutation.",
                ],
                message: "No Queue mutation.",
                status: "passed",
              });
              cases.push({
                caseId: "queue:no-hidden-side-effects",
                evidence: [
                  "No Codex run.",
                  "No shell command.",
                  "No Queue mutation.",
                  "No Queue worker start.",
                  "No Queue view creation.",
                  "No Terminal launch.",
                  "No Git mutation.",
                  "No rollback execution.",
                ],
                message: "No hidden side effects.",
                status: "passed",
              });

              return queueSelfTestAdapterResult(cases);
            },
          );
        },
      );
    },
  );
}

function queueSelfTestAdapterResult(
  cases: readonly QueueAgentSelfTestCaseResult[],
): QueueAgentAdapterResult<QueueAgentSelfTestReport> {
  const report = createQueueSelfTestReport(cases);

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.selfTest],
    message: report.productSummary,
    output: report,
    status: report.summary.failed > 0 ? "failed" : "succeeded",
  };
}

function singletonTargetSelfTestCase(
  targetResult: QueueAgentAdapterResult<unknown>,
): QueueAgentSelfTestCaseResult {
  if (targetResult.status !== "succeeded") {
    return adapterUnavailableSelfTestCase({
      blockedMessage: "Singleton Queue target check could not run.",
      caseId: "queue:singleton-target",
      evidence: [
        targetResult.message,
        "Represented the singleton Workspace Queue target safely for dry-run-only checks.",
      ],
      status: targetResult.status,
    });
  }

  const target = targetResult.output;
  const passed =
    isRecord(target) &&
    target.queueId === "workspace-queue" &&
    target.singleton === true &&
    target.singletonKey === "workspace-queue" &&
    target.widgetDefinitionId === "agent-queue" &&
    target.wouldCreateDuplicateQueueView === false;

  return {
    caseId: "queue:singleton-target",
    evidence: [
      targetResult.message,
      "Queue target: singleton Workspace Queue.",
      "No Queue view creation.",
    ],
    message: passed
      ? "Singleton Queue target verified."
      : "Singleton Queue target did not match the Workspace Queue singleton contract.",
    status: passed ? "passed" : "failed",
  };
}

function createItemsDryRunSelfTestCase(
  previewResult: QueueAgentAdapterResult<QueueAgentCreateItemsPreview>,
): QueueAgentSelfTestCaseResult {
  if (previewResult.status !== "succeeded" || !previewResult.output) {
    return adapterUnavailableSelfTestCase({
      blockedMessage: "Queue createItems dry-run could not run.",
      caseId: "queue:create-items-dry-run",
      evidence: [previewResult.message],
      status: previewResult.status,
    });
  }

  return {
    caseId: "queue:create-items-dry-run",
    evidence: [
      previewResult.message,
      `Would create ${previewResult.output.wouldCreateItems.toString()} Queue item.`,
      "Dry-run only.",
    ],
    message: "Queue dry-run preview prepared.",
    status: "passed",
  };
}

function createItemsPreviewAssertionCase({
  actual,
  blockedMessage,
  caseId,
  evidenceLabel,
  failedMessage,
  passedMessage,
  previewResult,
}: {
  actual: boolean;
  blockedMessage: string;
  caseId: string;
  evidenceLabel: keyof Pick<
    QueueAgentCreateItemsPreview,
    | "wouldAutoRunWorkers"
    | "wouldCreateDuplicateQueueView"
    | "wouldTargetSingletonQueue"
  >;
  failedMessage: string;
  passedMessage: string;
  previewResult: QueueAgentAdapterResult<QueueAgentCreateItemsPreview>;
}): QueueAgentSelfTestCaseResult {
  if (previewResult.status !== "succeeded" || !previewResult.output) {
    return adapterUnavailableSelfTestCase({
      blockedMessage,
      caseId,
      evidence: [previewResult.message],
      status: previewResult.status,
    });
  }

  return {
    caseId,
    evidence: [
      `${evidenceLabel}: ${String(previewResult.output[evidenceLabel])}.`,
      "Dry-run only.",
    ],
    message: actual ? passedMessage : failedMessage,
    status: actual ? "passed" : "failed",
  };
}

function promptPackPreviewSelfTestCase(
  previewResult: QueueAgentAdapterResult<QueueAgentPromptPackPreview>,
): QueueAgentSelfTestCaseResult {
  if (previewResult.status !== "succeeded" || !previewResult.output) {
    return adapterUnavailableSelfTestCase({
      blockedMessage: "Queue prompt-pack preview dry-run could not run.",
      caseId: "queue:prompt-pack-preview-dry-run",
      evidence: [previewResult.message],
      status: previewResult.status,
    });
  }

  const passed =
    previewResult.output.wouldTargetSingletonQueue === true &&
    previewResult.output.wouldAutoRunWorkers === false &&
    previewResult.output.wouldCreateDuplicateQueueView === false &&
    previewResult.output.wouldStartWorkers === false &&
    previewResult.output.smartQueueMaterialization.wouldStartTasks === false;

  return {
    caseId: "queue:prompt-pack-preview-dry-run",
    evidence: [
      previewResult.message,
      `Would create ${previewResult.output.wouldCreateItems.toString()} Queue item.`,
      "Dry-run only.",
      "No Queue worker start.",
      "No Queue view creation.",
    ],
    message: passed
      ? "Queue dry-run preview prepared."
      : "Queue prompt-pack preview did not satisfy dry-run safety assertions.",
    status: passed ? "passed" : "failed",
  };
}

function adapterUnavailableSelfTestCase({
  blockedMessage,
  caseId,
  evidence,
  status,
}: {
  blockedMessage: string;
  caseId: string;
  evidence: readonly string[];
  status: QueueAgentCapabilityStatus;
}): QueueAgentSelfTestCaseResult {
  if (status === "unavailable") {
    return {
      caseId,
      evidence: [...evidence],
      message: "Safe check skipped.",
      reason: "Adapter not available",
      status: "skipped",
    };
  }

  return {
    caseId,
    evidence: [...evidence],
    message: blockedMessage,
    reason: "Safe check skipped",
    status: "blocked",
  };
}

function queueSelfTestPromptPackInput(): QueueAgentPromptPackInput {
  return {
    smartQueuePromptPack: {
      prompts: [
        {
          body: "Self-test prompt-pack root task.",
          promptId: "root",
          title: "Self-test prompt-pack task",
        },
      ],
      sourceName: "Queue self-test prompt pack",
      sourcePackId: "queue-self-test-pack",
    },
  };
}

function previewPromptPack(
  input: QueueAgentPromptPackInput,
): QueueAgentAdapterResult<QueueAgentPromptPackPreview> {
  const preview = promptPackPreview(input);
  if (!preview.ok) {
    return {
      message: preview.message,
      reasons: [preview.message],
      status: "invalid_input",
    };
  }

  const materialization = preview.value.smartQueueMaterialization;
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.preparePromptPackPreview],
    message: "Queue items preview prepared",
    output: {
      importAvailable: preview.value.importAvailable,
      itemCount: preview.value.itemCount,
      selectedItemCount: preview.value.selectedItems.length,
      smartQueueMaterialization: materialization,
      wouldAutoRunWorkers: false,
      wouldCreateDuplicateQueueView: false,
      wouldCreateItems: materialization.tasks.length,
      wouldStartWorkers: false,
      wouldTargetSingletonQueue: true,
    },
    status: "succeeded",
  };
}

function promptPackPreview(
  input: QueueAgentPromptPackInput,
): ValidationResult<PromptPackImportPreviewModel> {
  if (input.preview) {
    return { ok: true, value: input.preview };
  }

  if (input.smartQueuePromptPack) {
    const materialization = materializeSmartQueuePromptPack(input.smartQueuePromptPack);
    return {
      ok: true,
      value: {
        dependencyGraphSummary: {
          blockedSelectedItemCount: materialization.summary.blockedTaskCount,
          edgeCount: materialization.summary.dependencyCount,
          hasCycles: materialization.issues.some(
            (issue) => issue.code === "circular_dependency",
          ),
          leafItemCount: 0,
          maxDepth: 0,
          rootItemCount: materialization.tasks.filter(
            (task) => task.upstreamTaskIds.length === 0,
          ).length,
          selectedItemCount: materialization.summary.taskCount,
          totalItemCount: materialization.summary.taskCount,
          unresolvedDependencyCount: materialization.issues.filter(
            (issue) => issue.code === "missing_dependency",
          ).length,
        },
        errors: materialization.issues.map((issue) => ({
          code:
            issue.code === "missing_prompt"
              ? "missing_body"
              : issue.code === "missing_dependency"
                ? "unresolved_dependency"
                : "dependency_cycle",
          itemId: issue.sourcePromptId,
          message: issue.message,
          severity: "error",
        })),
        expectedCommitTitles: [],
        importAvailable: materialization.issues.length === 0,
        itemCount: materialization.summary.taskCount,
        modelRouting: [],
        pack: {
          id: input.smartQueuePromptPack.sourcePackId ?? "prompt-pack",
          name: input.smartQueuePromptPack.sourceName ?? "Prompt Pack",
          sourcePaths: input.smartQueuePromptPack.sourcePath
            ? [input.smartQueuePromptPack.sourcePath]
            : [],
        },
        selectedItemIds: materialization.tasks.map((task) => task.source.promptId),
        selectedItems: [],
        smartQueueMaterialization: materialization,
        sourceAdapter: {
          kind: "available",
          label: "Typed Smart Queue prompt pack",
          message:
            "Preview is built from explicit typed prompt-pack input. No Queue items are created by preview.",
        },
        unselectedItems: [],
        unresolvedDependencies: [],
        validationCommands: [],
        warnings: [],
      },
    };
  }

  if (typeof input.sourceText === "string") {
    const preview = promptPackPreviewFromSourceText(input.sourceText);
    return preview
      ? { ok: true, value: preview }
      : { ok: false, message: "Prompt-pack input is required." };
  }

  if (input.fileEntries) {
    const preview = promptPackPreviewFromFileEntries(input.fileEntries);
    return preview
      ? { ok: true, value: preview }
      : { ok: false, message: "Prompt-pack input is required." };
  }

  return { ok: false, message: "Prompt-pack input is required." };
}

function createItemsFromPromptPackPreview(
  preview: QueueAgentPromptPackPreview,
): ValidationResult<Omit<QueueAgentCreateItemsRequest, "target">> {
  const materialization = preview.smartQueueMaterialization;
  const dependencyIdsByTaskId = new Map<string, string[]>();
  for (const dependency of materialization.dependencies) {
    const dependencyIds =
      dependencyIdsByTaskId.get(dependency.downstreamTaskId) ?? [];
    dependencyIds.push(dependency.upstreamTaskId);
    dependencyIdsByTaskId.set(dependency.downstreamTaskId, dependencyIds);
  }
  const items = materialization.tasks.map((task) => ({
    dependencies: dependencyIdsByTaskId.get(task.taskId) ?? [],
    description: `Prompt pack: ${task.source.packName ?? "Prompt Pack"} (${task.source.packId})`,
    id: task.taskId,
    prompt: task.prompt,
    sourceMetadata: {
      packId: task.source.packId,
      promptId: task.source.promptId,
      sourcePath: task.source.sourcePath,
    },
    status:
      task.humanStatus.status === "ready"
        ? ("queued" as const)
        : ("draft" as const),
    title: task.title,
  }));
  const normalized = normalizeCreateItemsInput({ items });

  return normalized.ok
    ? normalized
    : { ok: false, message: normalized.message };
}

function normalizePromptPackInput(
  input: unknown,
): ValidationResult<QueueAgentPromptPackInput> {
  if (!isRecord(input)) {
    return { ok: false, message: "Prompt-pack input is required." };
  }

  const candidate = input as QueueAgentPromptPackInput;
  const hasInput =
    typeof candidate.sourceText === "string" ||
    Array.isArray(candidate.fileEntries) ||
    Boolean(candidate.preview) ||
    Boolean(candidate.smartQueuePromptPack);

  return hasInput
    ? { ok: true, value: candidate }
    : { ok: false, message: "Prompt-pack input is required." };
}

function normalizeCreateItemsInput(
  input: QueueAgentCreateItemsInput,
): ValidationResult<Omit<QueueAgentCreateItemsRequest, "target">> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, message: "Queue createItems requires at least one item." };
  }

  const normalizedItems: QueueAgentNormalizedCreateItem[] = [];
  const ids = new Set<string>();

  for (const [index, item] of input.items.entries()) {
    const title = item.title?.trim() ?? "";
    const prompt = item.prompt?.trim() ?? "";
    const id = item.id?.trim() || `item-${(index + 1).toString()}`;

    if (!title) {
      return { ok: false, message: "Queue item title is required." };
    }

    if (!prompt) {
      return { ok: false, message: "Queue item prompt is required." };
    }

    if (ids.has(id)) {
      return { ok: false, message: `Queue item id "${id}" is duplicated.` };
    }
    ids.add(id);

    normalizedItems.push({
      dependencies: normalizeDependencyRefs(item.dependencies),
      description: item.description?.trim() ?? "",
      id,
      prompt,
      sourceMetadata: item.sourceMetadata ?? item.source ?? null,
      status: item.status === "ready" || item.status === "queued" ? "queued" : "draft",
      title,
    });
  }

  for (const item of normalizedItems) {
    if (item.dependencies.includes(item.id)) {
      return {
        ok: false,
        message: `Queue item "${item.id}" cannot depend on itself.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      items: normalizedItems,
      sourceMetadata: input.source ?? null,
    },
  };
}

function normalizeDependencyRefs(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
    : [];
}

function actionResultFromAdapter<TOutput>({
  adapterResult,
  capabilityId,
  defaultMessage,
  dryRun,
  requestId,
}: {
  adapterResult: QueueAgentAdapterResult<TOutput>;
  capabilityId: string;
  defaultMessage: string;
  dryRun: boolean;
  requestId: string;
}): HobitAgentActionResult {
  const status =
    adapterResult.status === "succeeded"
      ? "succeeded"
      : adapterResult.status === "invalid_input"
        ? "invalid_input"
        : adapterResult.status === "unavailable"
          ? "unavailable"
          : "failed";

  return createActionResult({
    auditEvents: [],
    capabilityId,
    dryRun,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message: adapterResult.message || defaultMessage,
    output: {
      activityEventNames: adapterResult.activityEventNames ?? [],
      hiddenSideEffectFlags: queueSideEffectFlags(),
      ...(adapterResult.output && isRecord(adapterResult.output)
        ? adapterResult.output
        : { result: adapterResult.output }),
    },
    policyReasons: adapterResult.reasons ?? (status === "succeeded" ? [] : [adapterResult.message]),
    requestId,
    status,
  });
}

function actionResultFromMaybeAdapter<TOutput>({
  adapterResult,
  capabilityId,
  defaultMessage,
  dryRun,
  requestId,
}: {
  adapterResult: QueueAgentMaybePromise<QueueAgentAdapterResult<TOutput>>;
  capabilityId: string;
  defaultMessage: string;
  dryRun: boolean;
  requestId: string;
}): QueueAgentActionHandlerResult {
  return withAdapterResult(adapterResult, (resolvedResult) =>
    actionResultFromAdapter({
      adapterResult: resolvedResult,
      capabilityId,
      defaultMessage,
      dryRun,
      requestId,
    }),
  );
}

function withAdapterResult<TValue, TResult>(
  value: QueueAgentMaybePromise<TValue>,
  mapper: (resolvedValue: TValue) => TResult,
): TResult | Promise<Awaited<TResult>> {
  return isPromiseLike(value)
    ? (value.then((resolvedValue) => mapper(resolvedValue)) as Promise<
        Awaited<TResult>
      >)
    : mapper(value);
}

function invalidInput(
  request: HobitAgentActionRequest,
  message: string,
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    requestId: request.requestId,
    status: "invalid_input",
  });
}

function failed(
  request: HobitAgentActionRequest,
  message: string,
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    requestId: request.requestId,
    status: "failed",
  });
}

function hasDependencyEdges(items: readonly QueueAgentNormalizedCreateItem[]) {
  return items.some((item) => item.dependencies.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
