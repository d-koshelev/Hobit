import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
  WorkspaceGitDiffSummary,
} from "../../workspace/types";
import type {
  QueueCreateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../queue/agentQueueWidgetApiTypes";
import {
  displayTaskTitle,
  normalizeQueueTag,
} from "../agentQueueTaskUiModel";
import {
  resolveDiffReviewInputSnapshot,
  type DiffReviewInputAvailabilitySummary,
  type ResolveDiffReviewInputSnapshotInput,
} from "./diffReviewInputSnapshotResolver";
import {
  buildDiffReviewPromptBody,
  type DiffReviewRequest,
} from "./diffReviewModel";
import type { ValidationResultSummary } from "../validation";

export type DiffReviewQueueItemWarningCode =
  | "missing_diff"
  | "missing_report"
  | "missing_validation"
  | "source_link_metadata_unsupported"
  | "dependency_relation_unsupported"
  | "queue_create_failed";

export type DiffReviewQueueItemCreationWarning = {
  code: DiffReviewQueueItemWarningCode;
  message: string;
};

export type DiffReviewQueueItemCreationResult = {
  createdReviewTaskId: string | null;
  createdReviewTaskTitle: string | null;
  createResult: QueueWidgetActionResult<QueueWidgetItemSnapshot>;
  metadata: DiffReviewQueueItemCreateRequest["metadata"];
  prompt: string;
  sourceTaskId: string;
  status: "created" | "failed";
  warnings: DiffReviewQueueItemCreationWarning[];
};

export type DiffReviewQueueItemCreateAction = (
  request: Omit<QueueCreateItemRequest, "workspaceId">,
) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;

export type BuildDiffReviewQueueItemCreateRequestInput = {
  agentFinalResponse?: string | null;
  dependentTasks?: AgentQueueTask[];
  dependentTasksCanBeUnblocked?: boolean | null;
  diffSummary?: WorkspaceGitDiffSummary | null;
  fileChangeSummary?: string | null;
  now?: () => string;
  projectContracts?: string[];
  report?: AgentQueueWorkerExecutionReport | null;
  sourceTask: AgentQueueTask;
  testsAddedOrUpdated?: boolean | null;
  validationEvidenceSummary?: ValidationResultSummary | null;
};

export type DiffReviewQueueItemCreateRequest = {
  metadata: {
    readonlyByDefault: true;
    reviewMode: "contract_scope" | "diff_vs_report";
    reviewType: "diff_review";
    sourceTaskId: string;
  };
  request: Omit<QueueCreateItemRequest, "workspaceId">;
  reviewRequest: DiffReviewRequest;
  warnings: DiffReviewQueueItemCreationWarning[];
};

export type CreateDiffReviewQueueItemInput =
  BuildDiffReviewQueueItemCreateRequestInput & {
    createItem: DiffReviewQueueItemCreateAction;
  };

export async function createDiffReviewQueueItem({
  createItem,
  ...input
}: CreateDiffReviewQueueItemInput): Promise<DiffReviewQueueItemCreationResult> {
  const built = buildDiffReviewQueueItemCreateRequest(input);
  const createResult = await createItem(built.request);
  const warnings = [...built.warnings];

  if (!createResult.ok || !createResult.item) {
    warnings.push({
      code: "queue_create_failed",
      message:
        createResult.error?.message ??
        createResult.message ??
        "Queue create action failed; no Diff Review item was created.",
    });

    return {
      createResult,
      createdReviewTaskId: null,
      createdReviewTaskTitle: null,
      metadata: built.metadata,
      prompt: built.request.prompt ?? "",
      sourceTaskId: input.sourceTask.queueItemId,
      status: "failed",
      warnings,
    };
  }

  if (!createResult.item.dependencies.includes(input.sourceTask.queueItemId)) {
    warnings.push({
      code: "dependency_relation_unsupported",
      message:
        "Queue create action did not preserve the source task dependency relation; the source link remains in the prompt/description.",
    });
  }

  return {
    createResult,
    createdReviewTaskId: createResult.item.id,
    createdReviewTaskTitle: createResult.item.title,
    metadata: built.metadata,
    prompt: built.request.prompt ?? "",
    sourceTaskId: input.sourceTask.queueItemId,
    status: "created",
    warnings,
  };
}

export function buildDiffReviewQueueItemCreateRequest({
  now,
  sourceTask,
  ...snapshotInput
}: BuildDiffReviewQueueItemCreateRequestInput): DiffReviewQueueItemCreateRequest {
  const resolved = resolveDiffReviewInputSnapshot({
    ...snapshotInput,
    sourceTask,
  });
  const reviewRequest: DiffReviewRequest = {
    createdAt: now?.() ?? new Date().toISOString(),
    inputSnapshot: resolved.inputSnapshot,
    readonlyByDefault: true,
    requestId: `diff-review-${sourceTask.queueItemId}`,
    sourceTask: resolved.sourceTask,
    state: "draft",
    workspaceId: sourceTask.workspaceId,
  };
  const prompt = buildDiffReviewPromptBody(reviewRequest);
  const queueTag = normalizeQueueTag(sourceTask);
  const reviewMode = snapshotInput.report ? "diff_vs_report" : "contract_scope";
  const title = diffReviewQueueItemTitle(sourceTask);
  const warnings = warningListForAvailability(resolved.availability);

  warnings.push({
    code: "source_link_metadata_unsupported",
    message:
      "Current Queue create action has no first-class Diff Review metadata field; source task id and review type are preserved in the title, description, dependency, and prompt.",
  });

  return {
    metadata: {
      readonlyByDefault: true,
      reviewMode,
      reviewType: "diff_review",
      sourceTaskId: sourceTask.queueItemId,
    },
    request: {
      approvalPolicy: sourceTask.approvalPolicy ?? null,
      codexExecutable: sourceTask.codexExecutable ?? null,
      dependencies: [sourceTask.queueItemId],
      description: [
        `Source task: ${sourceTask.queueItemId}`,
        `Review type: ${reviewMode}`,
        "Read-only Diff Review item. No code changes, execution, finalization, or dependent unblock is requested by default.",
      ].join("\n"),
      executionPolicy: "manual",
      executionWorkspace: sourceTask.executionWorkspace ?? null,
      itemType: "diff_review",
      priority: sourceTask.priority,
      prompt,
      queueTag: {
        id: queueTag.queueTagId,
        name: queueTag.queueTagName,
      },
      sandbox: sourceTask.sandbox ?? null,
      status: "queued",
      title,
    },
    reviewRequest,
    warnings,
  };
}

export function diffReviewQueueItemTitle(sourceTask: AgentQueueTask) {
  return `Diff Review - ${displayTaskTitle(sourceTask)}`;
}

function warningListForAvailability(
  availability: DiffReviewInputAvailabilitySummary,
): DiffReviewQueueItemCreationWarning[] {
  const warnings: DiffReviewQueueItemCreationWarning[] = [];

  if (!availability.hasActualDiffSummary) {
    warnings.push({
      code: "missing_diff",
      message:
        "Diff/file-change summary is missing; review prompt instructs manual read-only diff inspection.",
    });
  }

  if (!availability.hasReport) {
    warnings.push({
      code: "missing_report",
      message:
        "Source task report/final response summary is missing; review prompt marks the report comparison as incomplete.",
    });
  }

  if (!availability.hasValidationEvidence) {
    warnings.push({
      code: "missing_validation",
      message:
        "Validation evidence is missing; review prompt requires an explicit validation recommendation.",
    });
  }

  return warnings;
}
