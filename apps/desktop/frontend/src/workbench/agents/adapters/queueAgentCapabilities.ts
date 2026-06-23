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
  queueAgentCapabilityStatusToBrokerStatus,
  queueNextActionUnavailableFields,
  queueSideEffectFlags,
  QUEUE_ACTIVITY_EVENTS,
  singletonQueueTarget,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentCapabilityStatus,
  type QueueAgentControlGetInput,
  type QueueAgentControlGetResult,
  type QueueAgentControlSetManualEnabledInput,
  type QueueAgentControlSetManualEnabledResult,
  type QueueAgentCreateItemInput,
  type QueueAgentCreateItemsInput,
  type QueueAgentCreateItemsRequest,
  type QueueAgentCreateItemsPreview,
  type QueueAgentEnableInput,
  type QueueAgentMaybePromise,
  type QueueAgentListItemsInput,
  type QueueAgentNormalizedCreateItem,
  type QueueAgentPromoteDraftInput,
  type QueueAgentPromptPackInput,
  type QueueAgentPromptPackPreview,
  type QueueAgentSelfTestCaseResult,
  type QueueAgentSelfTestReport,
  type QueueAgentStartRunInput,
  type QueueAgentUpdateRunSettingsInput,
} from "./queueAgentCapabilityTypes";
import {
  QUEUE_RUN_APPROVAL_POLICY_VALUES,
  QUEUE_RUN_SANDBOX_VALUES,
  QUEUE_START_RUN_CONFIRMATION_FIELD,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../capabilities/queueCapabilityContracts";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { fieldPath?: string; ok: false; message: string };

type QueueAgentActionHandlerResult =
  | HobitAgentActionResult
  | Promise<HobitAgentActionResult>;

export function createQueueAgentActionHandlers(
  adapterApi: QueueAgentAdapterApi,
): HobitAgentActionHandlerMap {
  return {
    "queue.control.get": ({ request }) =>
      handleQueueControlGet(adapterApi, request),
    "queue.control.setManualEnabled": ({ request }) =>
      handleQueueControlSetManualEnabled(adapterApi, request),
    "queue.createItem": ({ request }) => handleCreateItem(adapterApi, request),
    "queue.createItems": ({ request }) => handleCreateItems(adapterApi, request),
    "queue.enable": ({ request }) => handleEnableQueue(adapterApi, request),
    "queue.importPromptPack": ({ request }) =>
      handleImportPromptPack(adapterApi, request),
    "queue.items.list": ({ request }) => handleListItems(adapterApi, request),
    "queue.item.promoteDraft": ({ request }) =>
      handlePromoteDraft(adapterApi, request),
    "queue.item.startRun": ({ request }) =>
      handleStartQueueLinkedRun(adapterApi, request),
    "queue.item.updateRunSettings": ({ request }) =>
      handleUpdateRunSettings(adapterApi, request),
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
      const createdItems = request.items.map(queueAgentCreatedItem);
      const nextSuggestedCapability =
        createdItems.find((item) => item.nextSuggestedCapability)
          ?.nextSuggestedCapability ?? null;
      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
        message: "Queue items created",
        output: {
          ...preview,
          ...nextActionFieldsForSingleCreatedItem(
            createdItems,
            nextSuggestedCapability,
          ),
          createdItemCount: request.items.length,
          createdItems,
          createdTaskIds: request.items.map((item) => item.id),
          dependencyEdgesPreserved: true,
          nextSuggestedCapability,
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
      const createdItems = request.items.map(queueAgentCreatedItem);
      const nextSuggestedCapability =
        createdItems.find((item) => item.nextSuggestedCapability)
          ?.nextSuggestedCapability ?? null;
      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.importPromptPack],
        message: "Queue items created",
        output: {
          ...promptPackPreview.output,
          ...preview,
          ...nextActionFieldsForSingleCreatedItem(
            createdItems,
            nextSuggestedCapability,
          ),
          createdItemCount: request.items.length,
          createdItems,
          createdTaskIds: request.items.map((item) => item.id),
          dependencyEdgesPreserved: true,
          nextSuggestedCapability,
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

function nextActionFieldsForSingleCreatedItem(
  createdItems: readonly ReturnType<typeof queueAgentCreatedItem>[],
  nextSuggestedCapability: string | null,
) {
  if (!nextSuggestedCapability) {
    return {};
  }

  if (createdItems.length !== 1) {
    return queueNextActionUnavailableFields({
      ambiguousCandidateIds: createdItems.map((item) => item.id),
      reasonCode: "ambiguous_next_action",
      reasonMessage:
        "A top-level Queue nextAction is unavailable because the result contains multiple created task ids.",
    });
  }

  const item = createdItems[0];
  return item.nextAction
    ? { nextAction: item.nextAction }
    : queueNextActionUnavailableFields({
        invalidPayloadReason: item.nextActionUnavailableReason,
        missingRequiredInputs: item.missingNextActionInput ?? [],
        reasonCode: item.missingNextActionInput?.length
          ? "missing_required_input"
          : "next_action_unavailable",
        reasonMessage:
          item.nextActionUnavailableReason ??
          "A top-level Queue nextAction is unavailable for the created task.",
      });
}

function handleQueueControlGet(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeQueueControlGetInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.getQueueControlState) {
    return unavailable(
      request,
      "Queue control read is unavailable: the Workspace Queue bridge did not expose typed Queue control state.",
    );
  }

  return actionResultFromMaybeAdapter<QueueAgentControlGetResult>({
    adapterResult: adapterApi.getQueueControlState(
      validation.value,
      contextForRequest(request),
    ),
    capabilityId: request.capabilityId,
    defaultMessage: "Queue control state read",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleQueueControlSetManualEnabled(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeQueueControlSetManualEnabledInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.setQueueControlManualEnabled) {
    return unavailable(
      request,
      "Queue manual control mutation is unavailable: the Workspace Queue bridge did not expose typed backend Queue control plumbing.",
    );
  }

  return actionResultFromMaybeAdapter<QueueAgentControlSetManualEnabledResult>({
    adapterResult: adapterApi.setQueueControlManualEnabled(
      validation.value,
      contextForRequest(request),
    ),
    capabilityId: request.capabilityId,
    defaultMessage: request.dryRun
      ? "Queue manual control preview prepared"
      : "Queue manual control set",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleListItems(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeListItemsInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.listItems) {
    return unavailable(
      request,
      "Queue task listing is unavailable: the Workspace Queue bridge did not expose a typed list capability.",
    );
  }

  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.listItems(validation.value, contextForRequest(request)),
    capabilityId: request.capabilityId,
    defaultMessage: "Queue items listed",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleUpdateRunSettings(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeUpdateRunSettingsInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.updateRunSettings) {
    return unavailable(
      request,
      "Queue run settings update is unavailable: the Workspace Queue bridge did not expose typed task update plumbing.",
    );
  }

  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.updateRunSettings(
      validation.value,
      contextForRequest(request),
    ),
    capabilityId: request.capabilityId,
    defaultMessage: request.dryRun
      ? "Queue run settings update preview prepared"
      : "Queue run settings updated",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handlePromoteDraft(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeTaskIdInput<QueueAgentPromoteDraftInput>(
    request.input,
    "queue.item.promoteDraft requires taskId.",
  );
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.promoteDraft) {
    return unavailable(
      request,
      "Queue draft promotion is unavailable: the Workspace Queue bridge did not expose typed Queue update plumbing.",
    );
  }

  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.promoteDraft(
      { taskId: validation.value.taskId },
      contextForRequest(request),
    ),
    capabilityId: request.capabilityId,
    defaultMessage: request.dryRun
      ? "Queue draft promotion preview prepared"
      : "Queue draft promoted",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleEnableQueue(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeEnableInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.enableQueue) {
    return unavailable(
      request,
      "Queue enable is unavailable: the Workspace Queue bridge did not expose typed Queue control plumbing.",
    );
  }

  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.enableQueue(validation.value, contextForRequest(request)),
    capabilityId: request.capabilityId,
    defaultMessage: request.dryRun
      ? "Queue enable preview prepared"
      : "Queue enabled",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
}

function handleStartQueueLinkedRun(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  const validation = normalizeStartRunInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  const confirmationError = exactQueueConfirmationError(request);
  if (confirmationError) {
    return invalidInput(request, confirmationError, {
      fieldPath: QUEUE_START_RUN_CONFIRMATION_FIELD,
    });
  }

  if (!adapterApi.startQueueLinkedRun) {
    return unavailable(
      request,
      "Queue-linked start is unavailable: the Workspace Queue bridge did not expose typed Direct Work start plumbing.",
    );
  }

  return actionResultFromMaybeAdapter({
    adapterResult: adapterApi.startQueueLinkedRun(
      validation.value,
      contextForRequest(request),
    ),
    capabilityId: request.capabilityId,
    defaultMessage: request.dryRun
      ? "Queue-linked run start preview prepared"
      : "Queue-linked run started",
    dryRun: request.dryRun,
    requestId: request.requestId,
  });
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
    return invalidInput(request, "Queue item input is required.", {
      fieldPath: "input",
    });
  }

  return runCreateItems(adapterApi, request, input, "Queue items created");
}

function handleCreateItems(
  adapterApi: QueueAgentAdapterApi,
  request: HobitAgentActionRequest,
): QueueAgentActionHandlerResult {
  if (!isRecord(request.input)) {
    return invalidInput(request, "Queue items input is required.", {
      fieldPath: "input",
    });
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
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  if (!adapterApi.supportsDependencyEdges && hasDependencyEdges(validation.value.items)) {
    return unavailable(
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
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
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
    return invalidInput(request, validation.message, {
      fieldPath: validation.fieldPath,
    });
  }

  const confirmationError = exactQueueConfirmationError(request);
  if (confirmationError) {
    return invalidInput(request, confirmationError, {
      fieldPath: QUEUE_START_RUN_CONFIRMATION_FIELD,
    });
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
          { fieldPath: "input" },
        );
      }

      const createValidation = createItemsFromPromptPackPreview(
        previewResult.output,
      );
      if (!createValidation.ok) {
        return invalidInput(request, createValidation.message, {
          fieldPath: createValidation.fieldPath,
        });
      }

      if (
        !adapterApi.supportsDependencyEdges &&
        hasDependencyEdges(createValidation.value.items)
      ) {
        return unavailable(
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
    dependsOn: dependencyIdsByTaskId.get(task.taskId) ?? [],
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
    : { fieldPath: normalized.fieldPath, ok: false, message: normalized.message };
}

function normalizePromptPackInput(
  input: unknown,
): ValidationResult<QueueAgentPromptPackInput> {
  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "Prompt-pack input is required.",
    };
  }

  const candidate = input as QueueAgentPromptPackInput;
  const hasInput =
    typeof candidate.sourceText === "string" ||
    Array.isArray(candidate.fileEntries) ||
    Boolean(candidate.preview) ||
    Boolean(candidate.smartQueuePromptPack);

  return hasInput
    ? { ok: true, value: candidate }
    : {
        fieldPath: "input",
        ok: false,
        message: "Prompt-pack input is required.",
      };
}

function normalizeListItemsInput(
  input: unknown,
): ValidationResult<QueueAgentListItemsInput> {
  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "Queue items list input must be an object.",
    };
  }

  const taskId = optionalStringField(input, "taskId");
  if (taskId.invalid) {
    return {
      fieldPath: "input.taskId",
      ok: false,
      message: "taskId must be a non-empty string when supplied.",
    };
  }

  const limit = optionalLimitField(input, "limit");
  if (limit.invalid) {
    return {
      fieldPath: "input.limit",
      ok: false,
      message: "limit must be an integer between 1 and 50 when supplied.",
    };
  }

  return {
    ok: true,
    value: {
      ...(taskId.value ? { taskId: taskId.value } : {}),
      ...(limit.value ? { limit: limit.value } : {}),
    },
  };
}

function normalizeUpdateRunSettingsInput(
  input: unknown,
): ValidationResult<
  Required<Pick<QueueAgentUpdateRunSettingsInput, "taskId">> &
    Omit<QueueAgentUpdateRunSettingsInput, "taskId">
> {
  const taskIdValidation =
    normalizeTaskIdInput<QueueAgentUpdateRunSettingsInput>(
      input,
      "queue.item.updateRunSettings requires taskId.",
    );
  if (!taskIdValidation.ok) {
    return taskIdValidation;
  }

  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "Queue run settings input must be an object.",
    };
  }

  const suppliedFields = [
    "approvalPolicy",
    "codexExecutable",
    "sandbox",
    "workspaceRoot",
  ].filter((fieldName) => hasOwn(input, fieldName));
  if (suppliedFields.length === 0) {
    return {
      fieldPath: "input",
      ok: false,
      message:
        "queue.item.updateRunSettings requires at least one supplied setting.",
    };
  }

  const codexExecutable = optionalStringOrNullField(input, "codexExecutable");
  if (codexExecutable.invalid) {
    return {
      fieldPath: "input.codexExecutable",
      ok: false,
      message: "codexExecutable must be a non-empty string when supplied.",
    };
  }

  const workspaceRoot = optionalStringOrNullField(input, "workspaceRoot");
  if (workspaceRoot.invalid) {
    return {
      fieldPath: "input.workspaceRoot",
      ok: false,
      message: "workspaceRoot must be a non-empty string when supplied.",
    };
  }

  const sandbox = optionalEnumOrNullField(input, "sandbox", [
    ...QUEUE_RUN_SANDBOX_VALUES,
  ]);
  if (sandbox.invalid) {
    return {
      fieldPath: "input.sandbox",
      ok: false,
      message:
        `sandbox must be one of ${QUEUE_RUN_SANDBOX_VALUES.join(", ")} when supplied.`,
    };
  }

  const approvalPolicy = optionalEnumOrNullField(input, "approvalPolicy", [
    ...QUEUE_RUN_APPROVAL_POLICY_VALUES,
  ]);
  if (approvalPolicy.invalid) {
    return {
      fieldPath: "input.approvalPolicy",
      ok: false,
      message:
        `approvalPolicy must be one of ${QUEUE_RUN_APPROVAL_POLICY_VALUES.join(", ")} when supplied.`,
    };
  }

  return {
    ok: true,
    value: {
      taskId: taskIdValidation.value.taskId,
      ...(hasOwn(input, "approvalPolicy")
        ? { approvalPolicy: approvalPolicy.value }
        : {}),
      ...(hasOwn(input, "codexExecutable")
        ? { codexExecutable: codexExecutable.value }
        : {}),
      ...(hasOwn(input, "sandbox") ? { sandbox: sandbox.value } : {}),
      ...(hasOwn(input, "workspaceRoot")
        ? { workspaceRoot: workspaceRoot.value }
        : {}),
    },
  };
}

function normalizeEnableInput(
  input: unknown,
): ValidationResult<QueueAgentEnableInput> {
  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "queue.enable input must be an object.",
    };
  }

  if (Object.keys(input).length > 0) {
    return {
      fieldPath: "input",
      ok: false,
      message:
        "queue.enable does not accept input fields. Use an empty input object.",
    };
  }

  return { ok: true, value: {} };
}

function normalizeQueueControlGetInput(
  input: unknown,
): ValidationResult<QueueAgentControlGetInput> {
  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "queue.control.get input must be an object.",
    };
  }

  const unsupported = Object.keys(input).filter(
    (fieldName) => fieldName !== "workspaceId",
  );
  if (unsupported.length > 0) {
    return {
      fieldPath: `input.${unsupported[0]}`,
      ok: false,
      message: `${unsupported[0]} is not supported by queue.control.get.`,
    };
  }

  const workspaceId = optionalStringField(input, "workspaceId");
  if (workspaceId.invalid) {
    return {
      fieldPath: "input.workspaceId",
      ok: false,
      message: "workspaceId must be a non-empty string when supplied.",
    };
  }

  return {
    ok: true,
    value: workspaceId.value ? { workspaceId: workspaceId.value } : {},
  };
}

function normalizeQueueControlSetManualEnabledInput(
  input: unknown,
): ValidationResult<QueueAgentControlSetManualEnabledInput> {
  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "queue.control.setManualEnabled input must be an object.",
    };
  }

  const supportedFields = new Set([
    "expectedVersion",
    "reason",
    "workspaceId",
  ]);
  const unsupported = Object.keys(input).filter(
    (fieldName) => !supportedFields.has(fieldName),
  );
  if (unsupported.length > 0) {
    return {
      fieldPath: `input.${unsupported[0]}`,
      ok: false,
      message: `${unsupported[0]} is not supported by queue.control.setManualEnabled.`,
    };
  }

  const workspaceId = optionalStringField(input, "workspaceId");
  if (workspaceId.invalid) {
    return {
      fieldPath: "input.workspaceId",
      ok: false,
      message: "workspaceId must be a non-empty string when supplied.",
    };
  }

  const expectedVersion = optionalNonNegativeIntegerField(
    input,
    "expectedVersion",
  );
  if (expectedVersion.invalid) {
    return {
      fieldPath: "input.expectedVersion",
      ok: false,
      message:
        "expectedVersion must be a non-negative integer when supplied.",
    };
  }

  const reason = optionalBoundedStringField(input, "reason", 240);
  if (reason.invalid) {
    return {
      fieldPath: "input.reason",
      ok: false,
      message:
        "reason must be a non-empty string up to 240 characters when supplied.",
    };
  }

  return {
    ok: true,
    value: {
      ...(expectedVersion.value !== undefined
        ? { expectedVersion: expectedVersion.value }
        : {}),
      ...(reason.value ? { reason: reason.value } : {}),
      ...(workspaceId.value ? { workspaceId: workspaceId.value } : {}),
    },
  };
}

function normalizeStartRunInput(
  input: unknown,
): ValidationResult<
  Required<Pick<QueueAgentStartRunInput, "executorWidgetId" | "taskId">> &
    Omit<QueueAgentStartRunInput, "executorWidgetId" | "taskId">
> {
  const taskIdValidation = normalizeTaskIdInput<QueueAgentStartRunInput>(
    input,
    "queue.item.startRun requires taskId.",
  );
  if (!taskIdValidation.ok) {
    return taskIdValidation;
  }

  if (!isRecord(input)) {
    return {
      fieldPath: "input",
      ok: false,
      message: "Queue start input must be an object.",
    };
  }

  const executorWidgetId = optionalStringField(input, "executorWidgetId");
  if (executorWidgetId.invalid || !executorWidgetId.value) {
    return {
      fieldPath: "input.executorWidgetId",
      ok: false,
      message: "queue.item.startRun requires executorWidgetId.",
    };
  }

  const queueId = optionalStringField(input, "queueId");
  if (queueId.invalid) {
    return {
      fieldPath: "input.queueId",
      ok: false,
      message: "queueId must be a non-empty string when supplied.",
    };
  }

  return {
    ok: true,
    value: {
      executorWidgetId: executorWidgetId.value,
      taskId: taskIdValidation.value.taskId,
      ...(queueId.value ? { queueId: queueId.value } : {}),
    },
  };
}

function normalizeTaskIdInput<TInput extends { taskId?: string }>(
  input: unknown,
  missingMessage: string,
): ValidationResult<
  Required<Pick<TInput, "taskId">> & Omit<TInput, "taskId">
> {
  if (!isRecord(input)) {
    return { fieldPath: "input", ok: false, message: missingMessage };
  }

  const taskId = optionalStringField(input, "taskId");
  if (taskId.invalid || !taskId.value) {
    return { fieldPath: "input.taskId", ok: false, message: missingMessage };
  }

  return {
    ok: true,
    value: {
      ...(input as Omit<TInput, "taskId">),
      taskId: taskId.value,
    } as Required<Pick<TInput, "taskId">> & Omit<TInput, "taskId">,
  };
}

function normalizeCreateItemsInput(
  input: QueueAgentCreateItemsInput,
): ValidationResult<Omit<QueueAgentCreateItemsRequest, "target">> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      fieldPath: "input.items",
      ok: false,
      message: "Queue createItems requires at least one item.",
    };
  }

  const normalizedItems: QueueAgentNormalizedCreateItem[] = [];
  const ids = new Set<string>();

  for (const [index, item] of input.items.entries()) {
    const title = item.title?.trim() ?? "";
    const prompt = item.prompt?.trim() ?? "";
    const id = item.id?.trim() || `item-${(index + 1).toString()}`;
    const dependencies = normalizeDependsOnRefs(item, index);

    if (!title) {
      return {
        fieldPath: `input.items[${index.toString()}].title`,
        ok: false,
        message: "Queue item title is required.",
      };
    }

    if (!prompt) {
      return {
        fieldPath: `input.items[${index.toString()}].prompt`,
        ok: false,
        message: "Queue item prompt is required.",
      };
    }

    if (ids.has(id)) {
      return {
        fieldPath: `input.items[${index.toString()}].id`,
        ok: false,
        message: `Queue item id "${id}" is duplicated.`,
      };
    }
    ids.add(id);

    if (!dependencies.ok) {
      return {
        fieldPath: dependencies.fieldPath,
        ok: false,
        message: dependencies.message,
      };
    }

    normalizedItems.push({
      dependencies: dependencies.value,
      description: item.description?.trim() ?? "",
      id,
      prompt,
      sourceMetadata: item.sourceMetadata ?? item.source ?? null,
      status: item.status === "ready" || item.status === "queued" ? "queued" : "draft",
      title,
    });
  }

  for (const [index, item] of normalizedItems.entries()) {
    if (item.dependencies.includes(item.id)) {
      return {
        fieldPath: `input.items[${index.toString()}].dependsOn`,
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

function normalizeDependsOnRefs(
  item: QueueAgentCreateItemInput,
  itemIndex: number,
): ValidationResult<string[]> {
  const input = item as Record<string, unknown>;

  if (hasOwn(input, "dependencies")) {
    return {
      fieldPath: `input.items[${itemIndex.toString()}].dependencies`,
      ok: false,
      message:
        "Queue item dependencies must use dependsOn, not dependencies.",
    };
  }

  if (hasOwn(input, "depends_on")) {
    return {
      fieldPath: `input.items[${itemIndex.toString()}].depends_on`,
      ok: false,
      message:
        "Queue item dependencies must use dependsOn, not depends_on.",
    };
  }

  if (!hasOwn(input, "dependsOn") || input.dependsOn === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(input.dependsOn)) {
    return {
      fieldPath: `input.items[${itemIndex.toString()}].dependsOn`,
      ok: false,
      message: "Queue item dependsOn must be an array of Queue task ids.",
    };
  }

  const dependencyIds: string[] = [];
  for (const [dependencyIndex, dependencyId] of input.dependsOn.entries()) {
    if (typeof dependencyId !== "string") {
      return {
        fieldPath: `input.items[${itemIndex.toString()}].dependsOn[${dependencyIndex.toString()}]`,
        ok: false,
        message:
          "Queue item dependsOn entries must be non-empty Queue task id strings.",
      };
    }

    const trimmedDependencyId = dependencyId.trim();
    if (!trimmedDependencyId) {
      return {
        fieldPath: `input.items[${itemIndex.toString()}].dependsOn[${dependencyIndex.toString()}]`,
        ok: false,
        message:
          "Queue item dependsOn entries must be non-empty Queue task id strings.",
      };
    }

    dependencyIds.push(trimmedDependencyId);
  }

  return { ok: true, value: dependencyIds };
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
  const status = queueAgentCapabilityStatusToBrokerStatus(adapterResult.status);

  return createActionResult({
    auditEvents: [],
    capabilityId,
    dryRun,
    fieldPath: adapterResult.fieldPath,
    fieldPaths: adapterResult.fieldPaths,
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
    reasonCode: adapterResult.reasonCode,
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
  options: { fieldPath?: string; fieldPaths?: string[] } = {},
): HobitAgentActionResult {
  return createActionResult({
    auditEvents: [],
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    fieldPath: options.fieldPath,
    fieldPaths: options.fieldPaths,
    hiddenSideEffectFlags: noHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    reasonCode: "invalid_payload",
    requestId: request.requestId,
    status: "invalid_input",
  });
}

function exactQueueConfirmationError(request: HobitAgentActionRequest) {
  return request.confirmationToken === QUEUE_START_RUN_CONFIRMATION_TOKEN
    ? null
    : `${request.capabilityId} requires top-level ${QUEUE_START_RUN_CONFIRMATION_FIELD} "${QUEUE_START_RUN_CONFIRMATION_TOKEN}".`;
}

function unavailable(
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
    reasonCode: "capability_unavailable",
    requestId: request.requestId,
    status: "unavailable",
  });
}

function hasDependencyEdges(items: readonly QueueAgentNormalizedCreateItem[]) {
  return items.some((item) => item.dependencies.length > 0);
}

function contextForRequest(request: HobitAgentActionRequest) {
  return {
    agentId: request.agentId,
    dryRun: request.dryRun,
    requestedAt: request.createdAt,
    requestId: request.requestId,
  };
}

function optionalStringField(
  input: Record<string, unknown>,
  fieldName: string,
): { invalid: boolean; value?: string } {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false };
  }

  if (typeof input[fieldName] !== "string") {
    return { invalid: true };
  }

  const value = input[fieldName].trim();
  return value ? { invalid: false, value } : { invalid: true };
}

function optionalStringOrNullField(
  input: Record<string, unknown>,
  fieldName: string,
): { invalid: boolean; value?: string | null } {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false };
  }

  if (input[fieldName] === null) {
    return { invalid: false, value: null };
  }

  if (typeof input[fieldName] !== "string") {
    return { invalid: true };
  }

  const value = input[fieldName].trim();
  return value ? { invalid: false, value } : { invalid: true };
}

function optionalEnumOrNullField<TValue extends string>(
  input: Record<string, unknown>,
  fieldName: string,
  values: readonly TValue[],
): { invalid: boolean; value?: TValue | null } {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false };
  }

  if (input[fieldName] === null) {
    return { invalid: false, value: null };
  }

  return typeof input[fieldName] === "string" &&
    values.includes(input[fieldName] as TValue)
    ? { invalid: false, value: input[fieldName] as TValue }
    : { invalid: true };
}

function optionalLimitField(
  input: Record<string, unknown>,
  fieldName: string,
): { invalid: boolean; value?: number } {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false };
  }

  const value = input[fieldName];
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 50
    ? { invalid: false, value }
    : { invalid: true };
}

function optionalNonNegativeIntegerField(
  input: Record<string, unknown>,
  fieldName: string,
): { invalid: boolean; value?: number } {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false };
  }

  const value = input[fieldName];
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? { invalid: false, value }
    : { invalid: true };
}

function optionalBoundedStringField(
  input: Record<string, unknown>,
  fieldName: string,
  maxLength: number,
): { invalid: boolean; value?: string } {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false };
  }

  if (typeof input[fieldName] !== "string") {
    return { invalid: true };
  }

  const value = input[fieldName].trim();
  return value && value.length <= maxLength
    ? { invalid: false, value }
    : { invalid: true };
}

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  object: TObject,
  key: TKey,
): object is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
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
