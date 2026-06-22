import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

import * as workflowApi from "./tauriAgentQueueWorkflowApi";
import {
  cancelAgentQueueWorkflow,
  getAgentQueueWorkflow,
  getAgentQueueWorkflowReport,
  listAgentQueueWorkflows,
  planAgentQueueWorkflowResume,
  startAgentQueueWorkflow,
} from "./tauriAgentQueueWorkflowApi";

const tauriRun = {
  action_log_summary_json: "{\"count\":0}",
  actor_id: "operator",
  blocker_reason: null,
  completed_at: null,
  created_at: "2026-06-22T10:00:00Z",
  current_step: "start",
  grant_summary_json: "{\"mode\":\"manual\"}",
  idempotency_keys_json: "{\"start\":\"key\"}",
  inputs_snapshot_json: "{\"taskId\":\"task_1\"}",
  mutation_refs_json: null,
  pause_reason: null,
  phase: "read",
  request_hash: "fnv1a64:abc",
  request_id: "request_1",
  schema_version: 1,
  slot_bindings_json: "{\"upstream\":{\"taskId\":\"task_1\"}}",
  status: "created",
  updated_at: "2026-06-22T10:00:00Z",
  variables_json: "{}",
  version: 1,
  workflow_id: "queue.read",
  workflow_run_id: "workflow_run_1",
  workspace_id: "workspace_1",
};

const expectedRun = {
  actionLogSummaryJson: "{\"count\":0}",
  actorId: "operator",
  blockerReason: null,
  completedAt: null,
  createdAt: "2026-06-22T10:00:00Z",
  currentStep: "start",
  grantSummaryJson: "{\"mode\":\"manual\"}",
  idempotencyKeysJson: "{\"start\":\"key\"}",
  inputsSnapshotJson: "{\"taskId\":\"task_1\"}",
  mutationRefsJson: null,
  pauseReason: null,
  phase: "read",
  requestHash: "fnv1a64:abc",
  requestId: "request_1",
  schemaVersion: 1,
  slotBindingsJson: "{\"upstream\":{\"taskId\":\"task_1\"}}",
  status: "created",
  updatedAt: "2026-06-22T10:00:00Z",
  variablesJson: "{}",
  version: 1,
  workflowId: "queue.read",
  workflowRunId: "workflow_run_1",
  workspaceId: "workspace_1",
};

describe("queueWorkflow Tauri API wrapper", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("starts queueWorkflow runs with typed snapshots and normalized results", async () => {
    mocks.invoke.mockResolvedValueOnce({
      blocker: null,
      conflict: null,
      status: "succeeded",
      workflow_run: tauriRun,
    });

    await expect(
      startAgentQueueWorkflow({
        actionLogSummary: { count: 0 },
        actorId: "operator",
        currentStep: "start",
        grantSummary: { mode: "manual" },
        idempotencyKeys: { start: "key" },
        inputsSnapshot: { taskId: "task_1" },
        mutationRefs: null,
        phase: "read",
        requestId: "request_1",
        slotBindings: { upstream: { taskId: "task_1" } },
        variables: {},
        workflowId: "queue.read",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      blocker: null,
      conflict: null,
      status: "succeeded",
      workflowRun: expectedRun,
    });

    expect(mocks.invoke).toHaveBeenCalledWith("start_agent_queue_workflow", {
      request: {
        action_log_summary: { count: 0 },
        actor_id: "operator",
        current_step: "start",
        grant_summary: { mode: "manual" },
        idempotency_keys: { start: "key" },
        inputs_snapshot: { taskId: "task_1" },
        mutation_refs: null,
        phase: "read",
        request_id: "request_1",
        slot_bindings: { upstream: { taskId: "task_1" } },
        variables: {},
        workflow_id: "queue.read",
        workspace_id: "workspace_1",
      },
    });
  });

  it("normalizes queueWorkflow start conflicts", async () => {
    mocks.invoke.mockResolvedValueOnce({
      blocker: null,
      conflict: {
        conflict_code: "request_id_conflict",
        conflict_message: "requestId already belongs to another snapshot",
        existing_request_hash: "fnv1a64:old",
        existing_workflow_run_id: "workflow_run_1",
        requested_request_hash: "fnv1a64:new",
      },
      status: "conflict",
      workflow_run: tauriRun,
    });

    await expect(
      startAgentQueueWorkflow({
        requestId: "request_1",
        workflowId: "queue.read",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      blocker: null,
      conflict: {
        conflictCode: "request_id_conflict",
        conflictMessage: "requestId already belongs to another snapshot",
        existingRequestHash: "fnv1a64:old",
        existingWorkflowRunId: "workflow_run_1",
        requestedRequestHash: "fnv1a64:new",
      },
      status: "conflict",
      workflowRun: expectedRun,
    });
  });

  it("gets, lists, cancels, and reports persisted queueWorkflow runs", async () => {
    const tauriAction = {
      action_id: "action_1",
      action_type: "read.aggregate",
      attempt_count: 1,
      blocker_code: null,
      blocker_message: null,
      completed_at: "2026-06-22T10:01:00Z",
      created_at: "2026-06-22T10:00:30Z",
      idempotency_key: "workflow_run_1:read.aggregate",
      result_refs_json: "{\"taskId\":\"task_1\"}",
      started_at: "2026-06-22T10:00:30Z",
      status: "completed",
      step_id: "read.aggregate",
      target_refs_json: "{\"taskId\":\"task_1\"}",
      updated_at: "2026-06-22T10:01:00Z",
      workflow_run_id: "workflow_run_1",
      workspace_id: "workspace_1",
    };

    mocks.invoke
      .mockResolvedValueOnce(tauriRun)
      .mockResolvedValueOnce([tauriRun])
      .mockResolvedValueOnce({
        blocker: null,
        status: "cancelled",
        workflow_run: { ...tauriRun, status: "cancelled" },
      })
      .mockResolvedValueOnce({
        actions: [tauriAction],
        report_summary: "1 persisted action; resume execution not implemented.",
        resume_available: false,
        resume_status: "not_implemented",
        workflow_run: tauriRun,
      });

    await expect(
      getAgentQueueWorkflow({
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual(expectedRun);
    expect(mocks.invoke).toHaveBeenLastCalledWith("get_agent_queue_workflow", {
      request: {
        workflow_run_id: "workflow_run_1",
        workspace_id: "workspace_1",
      },
    });

    await expect(
      listAgentQueueWorkflows({
        status: "created",
        workflowId: "queue.read",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual([expectedRun]);
    expect(mocks.invoke).toHaveBeenLastCalledWith("list_agent_queue_workflows", {
      request: {
        status: "created",
        workflow_id: "queue.read",
        workspace_id: "workspace_1",
      },
    });

    await expect(
      cancelAgentQueueWorkflow({
        actorId: "operator",
        reason: "operator stopped",
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      blocker: null,
      status: "cancelled",
      workflowRun: { ...expectedRun, status: "cancelled" },
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith("cancel_agent_queue_workflow", {
      request: {
        actor_id: "operator",
        reason: "operator stopped",
        workflow_run_id: "workflow_run_1",
        workspace_id: "workspace_1",
      },
    });

    await expect(
      getAgentQueueWorkflowReport({
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      actions: [
        {
          actionId: "action_1",
          actionType: "read.aggregate",
          attemptCount: 1,
          blockerCode: null,
          blockerMessage: null,
          completedAt: "2026-06-22T10:01:00Z",
          createdAt: "2026-06-22T10:00:30Z",
          idempotencyKey: "workflow_run_1:read.aggregate",
          resultRefsJson: "{\"taskId\":\"task_1\"}",
          startedAt: "2026-06-22T10:00:30Z",
          status: "completed",
          stepId: "read.aggregate",
          targetRefsJson: "{\"taskId\":\"task_1\"}",
          updatedAt: "2026-06-22T10:01:00Z",
          workflowRunId: "workflow_run_1",
          workspaceId: "workspace_1",
        },
      ],
      reportSummary: "1 persisted action; resume execution not implemented.",
      resumeAvailable: false,
      resumeStatus: "not_implemented",
      workflowRun: expectedRun,
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "get_agent_queue_workflow_report",
      {
        request: {
          workflow_run_id: "workflow_run_1",
          workspace_id: "workspace_1",
        },
      },
    );
  });

  it("plans queueWorkflow resume through the read-only Tauri command", async () => {
    mocks.invoke.mockResolvedValueOnce({
      actions: [],
      blockers: [
        {
          blocker_code: "fresh_confirmation_required",
          blocker_message:
            "A fresh exact structured confirmation is required before this workflow step can resume execution.",
          completion_decision_id: null,
          evidence_bundle_id: "evidence_1",
          failure_decision_id: null,
          message_id: "message_1",
          missing_required_field: "confirmationToken",
          run_id: "run_1",
          slot: "upstream",
          task_id: "task_1",
        },
      ],
      next_phase: "finalize",
      next_step: "mark_done_ready",
      reconciled_variables_json: "{}",
      report_summary:
        "Queue workflow run workflow_run_1 resume plan status is blocked_missing_confirmation. No workflow steps were executed.",
      required_confirmation: true,
      required_fresh_grant: true,
      resume_available: true,
      slot_reconciliations: [
        {
          aggregate_dependency_state: "unblocked",
          aggregate_evidence_state: "available",
          aggregate_review_state: "acked",
          aggregate_ticket_state: "review_needed",
          blocker_code: null,
          completion_decision_exists: false,
          completion_decision_id: null,
          evidence_bundle_id: "evidence_1",
          evidence_exists: true,
          executor_widget_id: "executor_1",
          failure_decision_exists: false,
          failure_decision_id: null,
          message_id: "message_1",
          review_message_exists: true,
          review_message_status: "acked",
          run_exists: true,
          run_id: "run_1",
          slot: "upstream",
          task_exists: true,
          task_id: "task_1",
        },
      ],
      status: "blocked_missing_confirmation",
      task_snapshots: [
        {
          commit_state: "not_required",
          dependency_state: "unblocked",
          evidence_state: "available",
          latest_completion_decision_id: null,
          latest_evidence_bundle_id: "evidence_1",
          latest_failure_decision_id: null,
          latest_review_message_id: "message_1",
          latest_review_message_status: "acked",
          latest_run_id: "run_1",
          latest_run_status: "completed",
          review_state: "acked",
          task_id: "task_1",
          ticket_state: "review_needed",
          validation_state: "not_required",
          worker_run_state: "completed",
        },
      ],
      terminal_status: null,
      workflow_run: tauriRun,
    });

    await expect(
      planAgentQueueWorkflowResume({
        expectedVersion: 1,
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      actions: [],
      blockers: [
        {
          blockerCode: "fresh_confirmation_required",
          blockerMessage:
            "A fresh exact structured confirmation is required before this workflow step can resume execution.",
          completionDecisionId: null,
          evidenceBundleId: "evidence_1",
          failureDecisionId: null,
          messageId: "message_1",
          missingRequiredField: "confirmationToken",
          runId: "run_1",
          slot: "upstream",
          taskId: "task_1",
        },
      ],
      nextPhase: "finalize",
      nextStep: "mark_done_ready",
      reconciledVariablesJson: "{}",
      reportSummary:
        "Queue workflow run workflow_run_1 resume plan status is blocked_missing_confirmation. No workflow steps were executed.",
      requiredConfirmation: true,
      requiredFreshGrant: true,
      resumeAvailable: true,
      slotReconciliations: [
        {
          aggregateDependencyState: "unblocked",
          aggregateEvidenceState: "available",
          aggregateReviewState: "acked",
          aggregateTicketState: "review_needed",
          blockerCode: null,
          completionDecisionExists: false,
          completionDecisionId: null,
          evidenceBundleId: "evidence_1",
          evidenceExists: true,
          executorWidgetId: "executor_1",
          failureDecisionExists: false,
          failureDecisionId: null,
          messageId: "message_1",
          reviewMessageExists: true,
          reviewMessageStatus: "acked",
          runExists: true,
          runId: "run_1",
          slot: "upstream",
          taskExists: true,
          taskId: "task_1",
        },
      ],
      status: "blocked_missing_confirmation",
      taskSnapshots: [
        {
          commitState: "not_required",
          dependencyState: "unblocked",
          evidenceState: "available",
          latestCompletionDecisionId: null,
          latestEvidenceBundleId: "evidence_1",
          latestFailureDecisionId: null,
          latestReviewMessageId: "message_1",
          latestReviewMessageStatus: "acked",
          latestRunId: "run_1",
          latestRunStatus: "completed",
          reviewState: "acked",
          taskId: "task_1",
          ticketState: "review_needed",
          validationState: "not_required",
          workerRunState: "completed",
        },
      ],
      terminalStatus: null,
      workflowRun: expectedRun,
    });
    expect(mocks.invoke).toHaveBeenCalledWith(
      "plan_agent_queue_workflow_resume",
      {
        request: {
          expected_version: 1,
          workflow_run_id: "workflow_run_1",
          workspace_id: "workspace_1",
        },
      },
    );
  });

  it("does not expose queueWorkflow resume execution from the wrapper", () => {
    expect("resumeAgentQueueWorkflow" in workflowApi).toBe(false);
  });
});
