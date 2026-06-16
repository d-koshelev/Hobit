import type { PromptPackFileEntry, PromptPackImportPreviewModel } from "../../promptPack";
import type {
  SmartQueueMaterializationPreview,
  SmartQueuePromptPackInput,
} from "../../queue/smartQueuePromptPackMaterialization";

export const QUEUE_AGENT_CAPABILITY_IDS = [
  "queue.createItem",
  "queue.createItems",
  "queue.importPromptPack",
  "queue.preparePromptPackPreview",
  "queue.selfTest",
  "queue.targetSingletonQueue",
] as const;

export const QUEUE_ACTIVITY_EVENTS = {
  createItem: ["hobit.agent.capability.queue.createItem.requested", "queue.itemCreated"],
  createItems: ["hobit.agent.capability.queue.createItems.requested", "queue.itemCreated"],
  importPromptPack: [
    "hobit.agent.capability.queue.importPromptPack.requested",
    "queue.itemCreated",
  ],
  preparePromptPackPreview: [
    "hobit.agent.capability.queue.preparePromptPackPreview.requested",
  ],
  selfTest: ["hobit.agent.capability.queue.selfTest.requested"],
  targetSingletonQueue: [
    "hobit.agent.capability.queue.targetSingletonQueue.requested",
  ],
} as const;

export type QueueAgentCapabilityId =
  (typeof QUEUE_AGENT_CAPABILITY_IDS)[number];

export type QueueAgentCapabilityStatus =
  | "succeeded"
  | "failed"
  | "invalid_input"
  | "unavailable";

export type QueueAgentSideEffectFlags = {
  didAutoRunWorkers: false;
  didCreateDuplicateQueueView: false;
  didExecuteRollback: false;
  didLaunchCodex: false;
  didLaunchShell: false;
  didLaunchTerminal: false;
  didMutateGit: false;
  didMutateQueue: false;
  didStartWorkers: false;
};

export type QueueAgentSingletonTarget = {
  queueId: "workspace-queue";
  singleton: true;
  singletonKey: "workspace-queue";
  widgetDefinitionId: "agent-queue";
  wouldCreateDuplicateQueueView: false;
};

export type QueueAgentSourceMetadata = {
  [key: string]: unknown;
};

export type QueueAgentCreateItemInput = {
  dependencies?: readonly string[];
  description?: string | null;
  id?: string;
  prompt?: string;
  source?: QueueAgentSourceMetadata;
  sourceMetadata?: QueueAgentSourceMetadata;
  status?: "draft" | "queued" | "ready";
  title?: string;
};

export type QueueAgentCreateItemsInput = {
  items?: readonly QueueAgentCreateItemInput[];
  source?: QueueAgentSourceMetadata;
};

export type QueueAgentNormalizedCreateItem = {
  dependencies: string[];
  description: string;
  id: string;
  prompt: string;
  sourceMetadata: QueueAgentSourceMetadata | null;
  status: "draft" | "queued";
  title: string;
};

export type QueueAgentCreateItemsRequest = {
  items: QueueAgentNormalizedCreateItem[];
  sourceMetadata: QueueAgentSourceMetadata | null;
  target: QueueAgentSingletonTarget;
};

export type QueueAgentCreateItemsPreview = {
  items: QueueAgentNormalizedCreateItem[];
  wouldAutoRunWorkers: false;
  wouldCreateDuplicateQueueView: false;
  wouldCreateItems: number;
  wouldTargetSingletonQueue: true;
};

export type QueueAgentCreatedItem = {
  dependencies: string[];
  id: string;
  prompt: string;
  sourceMetadata: QueueAgentSourceMetadata | null;
  status: "draft" | "queued";
  title: string;
};

export type QueueAgentCreateItemsResult = QueueAgentCreateItemsPreview & {
  createdItems: QueueAgentCreatedItem[];
  dependencyEdgesPreserved: boolean;
};

export type QueueAgentPromptPackInput = {
  fileEntries?: readonly PromptPackFileEntry[];
  preview?: PromptPackImportPreviewModel;
  smartQueuePromptPack?: SmartQueuePromptPackInput;
  sourceText?: string;
};

export type QueueAgentPromptPackPreview = {
  importAvailable: boolean;
  itemCount: number;
  selectedItemCount: number;
  smartQueueMaterialization: SmartQueueMaterializationPreview;
  wouldAutoRunWorkers: false;
  wouldCreateDuplicateQueueView: false;
  wouldCreateItems: number;
  wouldStartWorkers: false;
  wouldTargetSingletonQueue: true;
};

export type QueueAgentPromptPackImportResult = QueueAgentPromptPackPreview & {
  createdItems: QueueAgentCreatedItem[];
  dependencyEdgesPreserved: boolean;
};

export type QueueAgentSelfTestCaseStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";

export type QueueAgentSelfTestCaseResult = {
  caseId: string;
  evidence: string[];
  message: string;
  reason?: string;
  status: QueueAgentSelfTestCaseStatus;
};

export type QueueAgentSelfTestReport = {
  cases: QueueAgentSelfTestCaseResult[];
  hiddenSideEffectFlags: QueueAgentSideEffectFlags;
  productSummary: string;
  status: QueueAgentSelfTestCaseStatus;
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
};

export type QueueAgentAdapterResult<TOutput> = {
  activityEventNames?: string[];
  message: string;
  output?: TOutput;
  reasons?: string[];
  status: QueueAgentCapabilityStatus;
};

export type QueueAgentMaybePromise<T> = T | Promise<T>;

export type QueueAgentAdapterApi = {
  getSingletonQueueTarget: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSingletonTarget>>;
  previewCreateItems: (
    request: QueueAgentCreateItemsRequest,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentCreateItemsPreview>>;
  createItems: (
    request: QueueAgentCreateItemsRequest,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentCreateItemsResult>>;
  previewPromptPack: (
    input: QueueAgentPromptPackInput,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentPromptPackPreview>>;
  importPromptPack: (
    input: QueueAgentPromptPackInput,
    request: QueueAgentCreateItemsRequest,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentPromptPackImportResult>>;
  runQueueSelfTest?: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSelfTestReport>>;
  supportsDependencyEdges: boolean;
  supportsSafeMutationSandbox?: boolean;
};

export function singletonQueueTarget(): QueueAgentSingletonTarget {
  return {
    queueId: "workspace-queue",
    singleton: true,
    singletonKey: "workspace-queue",
    widgetDefinitionId: "agent-queue",
    wouldCreateDuplicateQueueView: false,
  };
}

export function queueSideEffectFlags(): QueueAgentSideEffectFlags {
  return {
    didAutoRunWorkers: false,
    didCreateDuplicateQueueView: false,
    didExecuteRollback: false,
    didLaunchCodex: false,
    didLaunchShell: false,
    didLaunchTerminal: false,
    didMutateGit: false,
    didMutateQueue: false,
    didStartWorkers: false,
  };
}

export function noHiddenSideEffectFlags() {
  return {
    noCodexRun: false,
    noGitMutation: false,
    noQueueMutation: false,
    noRollbackExecution: false,
    noShellCommand: false,
    noTerminalLaunch: false,
    noWorkerStart: false,
  } as const;
}

export function createQueueAgentItemsPreview(
  items: readonly QueueAgentNormalizedCreateItem[],
): QueueAgentCreateItemsPreview {
  return {
    items: [...items],
    wouldAutoRunWorkers: false,
    wouldCreateDuplicateQueueView: false,
    wouldCreateItems: items.length,
    wouldTargetSingletonQueue: true,
  };
}

export function queueAgentCreatedItem(
  item: QueueAgentNormalizedCreateItem,
): QueueAgentCreatedItem {
  return {
    dependencies: [...item.dependencies],
    id: item.id,
    prompt: item.prompt,
    sourceMetadata: item.sourceMetadata,
    status: item.status,
    title: item.title,
  };
}

export function createQueueSelfTestReport(
  cases: readonly QueueAgentSelfTestCaseResult[],
): QueueAgentSelfTestReport {
  const summary = {
    blocked: cases.filter((item) => item.status === "blocked").length,
    failed: cases.filter((item) => item.status === "failed").length,
    passed: cases.filter((item) => item.status === "passed").length,
    skipped: cases.filter((item) => item.status === "skipped").length,
    total: cases.length,
  };

  return {
    cases: [...cases],
    hiddenSideEffectFlags: queueSideEffectFlags(),
    productSummary:
      summary.failed > 0
        ? "Queue self-test failed"
        : summary.blocked > 0
          ? "Queue self-test blocked"
          : "Queue self-test passed",
    status:
      summary.failed > 0
        ? "failed"
        : summary.blocked > 0
          ? "blocked"
          : "passed",
    summary,
  };
}
