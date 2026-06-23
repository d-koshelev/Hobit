import { createActionResult, createNoHiddenSideEffectFlags } from "../broker/results";
import type {
  HobitAgentActionHandlerMap,
  HobitAgentActionRequest,
  HobitAgentActionResult,
} from "../broker/types";
import type { WidgetInstance } from "../../types";
import type { WorkspaceAgentQueueControlState } from "../../workspaceAgentQueueBridge";
import {
  AGENT_RUN_WIDGET_DEFINITION_ID,
  getWidgetDefinition,
} from "../../widgetRegistry";

export type WorkspaceAgentLiveContextSource = {
  currentRuntimeMode?: string | null;
  getQueueControlState?: () => WorkspaceAgentQueueControlState | null;
  workbenchId?: string | null;
  widgets?: readonly WidgetInstance[];
  workspaceId?: string | null;
  workspaceRootPath?: string | null;
};

type WorkspaceContextGetInput = {
  includeQueueControl?: boolean;
  includeWidgetSummary?: boolean;
};

type WorkbenchWidgetsListInput = {
  definitionIdFilter?: string;
  includeTitles?: boolean;
  visibleOnly?: boolean;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { fieldPath?: string; ok: false; message: string };

const MAX_WIDGETS = 50;

export function createWorkspaceAgentLiveContextActionHandlers(
  liveContext: WorkspaceAgentLiveContextSource | null | undefined,
): HobitAgentActionHandlerMap {
  return {
    "workspace.context.get": ({ request }) =>
      handleWorkspaceContextGet(liveContext, request),
    "workbench.widgets.list": ({ request }) =>
      handleWorkbenchWidgetsList(liveContext, request),
  };
}

function handleWorkspaceContextGet(
  liveContext: WorkspaceAgentLiveContextSource | null | undefined,
  request: HobitAgentActionRequest,
): HobitAgentActionResult {
  const validation = normalizeWorkspaceContextGetInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, validation.fieldPath);
  }

  const workspaceId = normalizedString(liveContext?.workspaceId);
  const workspaceRootPath = normalizedString(liveContext?.workspaceRootPath);
  const workbenchId = normalizedString(liveContext?.workbenchId);
  const missingCapabilities: string[] = [];

  if (!workspaceId) {
    missingCapabilities.push("workspace_unavailable");
  }
  if (!workbenchId) {
    missingCapabilities.push("workbench_unavailable");
  }

  const widgetSummary = validation.value.includeWidgetSummary
    ? summarizeWidgets(liveContext?.widgets ?? null, missingCapabilities)
    : undefined;
  const queueControlState = validation.value.includeQueueControl
    ? readQueueControlState(liveContext, workspaceId, missingCapabilities)
    : undefined;

  return createActionResult({
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message: "Workspace context read.",
    output: {
      currentRuntimeMode:
        normalizedString(liveContext?.currentRuntimeMode) ?? detectRuntimeMode(),
      currentWorkbenchAvailable: Boolean(workbenchId),
      currentWorkspaceAvailable: Boolean(workspaceId),
      hiddenSideEffectFlags: liveContextReadSideEffectFlags(),
      missingCapabilities,
      missingCapabilitiesSummary: missingCapabilities.join(", "),
      ...(queueControlState !== undefined ? { queueControlState } : {}),
      ...(widgetSummary ? { widgetSummary } : {}),
      workbenchId,
      workspaceId,
      workspaceRootPath,
    },
    policyReasons: [],
    requestId: request.requestId,
    status: "succeeded",
  });
}

function handleWorkbenchWidgetsList(
  liveContext: WorkspaceAgentLiveContextSource | null | undefined,
  request: HobitAgentActionRequest,
): HobitAgentActionResult {
  const validation = normalizeWorkbenchWidgetsListInput(request.input);
  if (!validation.ok) {
    return invalidInput(request, validation.message, validation.fieldPath);
  }

  const workbenchId = normalizedString(liveContext?.workbenchId);
  const workspaceId = normalizedString(liveContext?.workspaceId);
  const allWidgets = liveContext?.widgets;
  if (!workbenchId || !allWidgets) {
    const blockers = ["workbench_unavailable"];
    return createActionResult({
      capabilityId: request.capabilityId,
      dryRun: request.dryRun,
      hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
      message: "Workbench widget context is unavailable.",
      output: {
        agentExecutors: [],
        blockers,
        hiddenSideEffectFlags: liveContextReadSideEffectFlags(),
        missingCapabilities: blockers,
        recommendedExecutorWidgetId: null,
        widgetInstances: [],
        workbenchId,
        workspaceId,
      },
      policyReasons: blockers,
      reasonCode: "precondition_failed",
      requestId: request.requestId,
      status: "precondition_failed",
    });
  }

  const visibleOnly = validation.value.visibleOnly ?? true;
  const definitionIdFilter = validation.value.definitionIdFilter;
  const includeTitles = validation.value.includeTitles ?? false;
  const visibleScopedWidgets = allWidgets.filter(
    (widget) => !visibleOnly || widget.visible,
  );
  const listedWidgets = visibleScopedWidgets
    .filter(
      (widget) =>
        !definitionIdFilter || widget.definitionId === definitionIdFilter,
    )
    .slice(0, MAX_WIDGETS)
    .map((widget) => widgetSummary(widget, includeTitles));
  const agentExecutors = visibleScopedWidgets
    .filter((widget) => widget.definitionId === AGENT_RUN_WIDGET_DEFINITION_ID)
    .slice(0, MAX_WIDGETS)
    .map((widget) => widgetSummary(widget, includeTitles));
  const blockers = executorSelectionBlockers(agentExecutors.length);

  return createActionResult({
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message: "Workbench widgets listed.",
    output: {
      agentExecutors,
      blockers,
      capped:
        visibleScopedWidgets.length > listedWidgets.length ||
        visibleScopedWidgets.filter(
          (widget) => widget.definitionId === AGENT_RUN_WIDGET_DEFINITION_ID,
        ).length > agentExecutors.length,
      definitionIdFilter: definitionIdFilter ?? null,
      hiddenSideEffectFlags: liveContextReadSideEffectFlags(),
      missingCapabilities: blockers,
      recommendedExecutorWidgetId:
        agentExecutors.length === 1 ? agentExecutors[0]?.id ?? null : null,
      visibleOnly,
      widgetInstances: listedWidgets,
      workbenchId,
      workspaceId,
    },
    policyReasons: [],
    requestId: request.requestId,
    status: "succeeded",
  });
}

function normalizeWorkspaceContextGetInput(
  input: unknown,
): ValidationResult<WorkspaceContextGetInput> {
  const inputObject = normalizeObjectInput(
    input,
    "workspace.context.get input must be an object.",
  );
  if (!inputObject.ok) {
    return inputObject;
  }

  const unsupported = unsupportedFields(inputObject.value, [
    "includeQueueControl",
    "includeWidgetSummary",
  ]);
  if (unsupported.length > 0) {
    return {
      fieldPath: `input.${unsupported[0]}`,
      ok: false,
      message: `${unsupported[0]} is not supported by workspace.context.get.`,
    };
  }

  const includeQueueControl = optionalBooleanField(
    inputObject.value,
    "includeQueueControl",
  );
  if (includeQueueControl.invalid) {
    return {
      fieldPath: "input.includeQueueControl",
      ok: false,
      message: "includeQueueControl must be a boolean when supplied.",
    };
  }

  const includeWidgetSummary = optionalBooleanField(
    inputObject.value,
    "includeWidgetSummary",
  );
  if (includeWidgetSummary.invalid) {
    return {
      fieldPath: "input.includeWidgetSummary",
      ok: false,
      message: "includeWidgetSummary must be a boolean when supplied.",
    };
  }

  return {
    ok: true,
    value: {
      ...(includeQueueControl.value !== undefined
        ? { includeQueueControl: includeQueueControl.value }
        : {}),
      ...(includeWidgetSummary.value !== undefined
        ? { includeWidgetSummary: includeWidgetSummary.value }
        : {}),
    },
  };
}

function normalizeWorkbenchWidgetsListInput(
  input: unknown,
): ValidationResult<WorkbenchWidgetsListInput> {
  const inputObject = normalizeObjectInput(
    input,
    "workbench.widgets.list input must be an object.",
  );
  if (!inputObject.ok) {
    return inputObject;
  }

  const unsupported = unsupportedFields(inputObject.value, [
    "definitionIdFilter",
    "includeTitles",
    "visibleOnly",
  ]);
  if (unsupported.length > 0) {
    return {
      fieldPath: `input.${unsupported[0]}`,
      ok: false,
      message: `${unsupported[0]} is not supported by workbench.widgets.list.`,
    };
  }

  const definitionIdFilter = optionalStringField(
    inputObject.value,
    "definitionIdFilter",
  );
  if (definitionIdFilter.invalid) {
    return {
      fieldPath: "input.definitionIdFilter",
      ok: false,
      message: "definitionIdFilter must be a non-empty string when supplied.",
    };
  }

  const includeTitles = optionalBooleanField(inputObject.value, "includeTitles");
  if (includeTitles.invalid) {
    return {
      fieldPath: "input.includeTitles",
      ok: false,
      message: "includeTitles must be a boolean when supplied.",
    };
  }

  const visibleOnly = optionalBooleanField(inputObject.value, "visibleOnly");
  if (visibleOnly.invalid) {
    return {
      fieldPath: "input.visibleOnly",
      ok: false,
      message: "visibleOnly must be a boolean when supplied.",
    };
  }

  return {
    ok: true,
    value: {
      ...(definitionIdFilter.value
        ? { definitionIdFilter: definitionIdFilter.value }
        : {}),
      ...(includeTitles.value !== undefined
        ? { includeTitles: includeTitles.value }
        : {}),
      ...(visibleOnly.value !== undefined ? { visibleOnly: visibleOnly.value } : {}),
    },
  };
}

function summarizeWidgets(
  widgets: readonly WidgetInstance[] | null,
  missingCapabilities: string[],
) {
  if (!widgets) {
    missingCapabilities.push("workbench_widgets_unavailable");
    return {
      agentExecutorCount: 0,
      visibleWidgetCount: 0,
      widgetCount: 0,
    };
  }

  return {
    agentExecutorCount: widgets.filter(
      (widget) =>
        widget.visible && widget.definitionId === AGENT_RUN_WIDGET_DEFINITION_ID,
    ).length,
    visibleWidgetCount: widgets.filter((widget) => widget.visible).length,
    widgetCount: widgets.length,
  };
}

function readQueueControlState(
  liveContext: WorkspaceAgentLiveContextSource | null | undefined,
  workspaceId: string | null,
  missingCapabilities: string[],
) {
  if (!liveContext?.getQueueControlState) {
    missingCapabilities.push("queue_control_unavailable");
    return null;
  }

  const state = liveContext.getQueueControlState();
  if (!state) {
    missingCapabilities.push("queue_control_unavailable");
    return null;
  }

  return {
    backendOwned: state.backendOwned === true,
    globalExecutionState: state.globalExecutionState ?? null,
    queueEnabled: state.queueEnabled,
    reason: boundedText(state.reason),
    status:
      state.status ?? (state.queueEnabled ? "manual_enabled" : "disabled"),
    updatedAt: state.updatedAt ?? null,
    updatedByActorId: state.updatedByActorId ?? null,
    version: state.version ?? null,
    workspaceId: normalizedString(state.workspaceId) ?? workspaceId,
  };
}

function widgetSummary(widget: WidgetInstance, includeTitle: boolean) {
  const definition = getWidgetDefinition(widget.definitionId);
  return {
    category: definition?.category ?? null,
    definitionId: widget.definitionId,
    id: widget.id,
    ...(includeTitle ? { title: widget.title } : {}),
    visible: widget.visible,
  };
}

function executorSelectionBlockers(agentExecutorCount: number) {
  if (agentExecutorCount === 0) {
    return ["no_agent_executor"];
  }
  if (agentExecutorCount > 1) {
    return ["ambiguous_agent_executor"];
  }
  return [];
}

function normalizeObjectInput(
  input: unknown,
  message: string,
): ValidationResult<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { fieldPath: "input", ok: false, message };
  }
  return { ok: true, value: input };
}

function optionalBooleanField(input: Record<string, unknown>, fieldName: string) {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false, value: undefined };
  }

  const value = input[fieldName];
  return typeof value === "boolean"
    ? { invalid: false, value }
    : { invalid: true, value: undefined };
}

function optionalStringField(input: Record<string, unknown>, fieldName: string) {
  if (!hasOwn(input, fieldName) || input[fieldName] === undefined) {
    return { invalid: false, value: undefined };
  }

  const value = input[fieldName];
  if (typeof value !== "string") {
    return { invalid: true, value: undefined };
  }

  const trimmed = value.trim();
  return trimmed
    ? { invalid: false, value: trimmed }
    : { invalid: true, value: undefined };
}

function unsupportedFields(
  input: Record<string, unknown>,
  supportedFields: readonly string[],
) {
  const supported = new Set(supportedFields);
  return Object.keys(input).filter((fieldName) => !supported.has(fieldName));
}

function invalidInput(
  request: HobitAgentActionRequest,
  message: string,
  fieldPath?: string,
) {
  return createActionResult({
    capabilityId: request.capabilityId,
    dryRun: request.dryRun,
    ...(fieldPath ? { fieldPath } : {}),
    hiddenSideEffectFlags: createNoHiddenSideEffectFlags(),
    message,
    policyReasons: [message],
    reasonCode: "invalid_payload",
    requestId: request.requestId,
    status: "invalid_input",
  });
}

function liveContextReadSideEffectFlags() {
  return {
    didAutoRunWorkers: false,
    didExecuteRollback: false,
    didLaunchCodex: false,
    didLaunchShell: false,
    didLaunchTerminal: false,
    didMutateGit: false,
    didMutateQueue: false,
    didStartWorkers: false,
  } as const;
}

function detectRuntimeMode() {
  if (typeof window === "undefined") {
    return "non_renderer";
  }

  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window
    ? "tauri_desktop"
    : "browser";
}

function boundedText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}

function normalizedString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
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
