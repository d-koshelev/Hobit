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
  applyAgentQueueWorkflowRunSettings,
  getAgentQueueWorkflow,
  getAgentQueueWorkflowReport,
  listAgentQueueWorkflows,
  materializeAgentQueueWorkflowTaskSlot,
  planAgentQueueWorkflowResume,
  promoteAgentQueueWorkflowTaskSlot,
  recordAgentQueueWorkflowRunnerReport,
  recordAgentQueueWorkflowWorkerEvidence,
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

const tauriTask = {
  approval_policy: "never",
  assigned_executor_widget_id: "executor_widget_1",
  codex_executable: "codex.cmd",
  context_json: null,
  created_at: "2026-06-22T10:00:00Z",
  depends_on: ["task_upstream"],
  description: "Task description",
  execution_policy: "manual",
  execution_workspace: "C:/repo",
  priority: 1,
  prompt: "Task prompt",
  queue_item_id: "task_downstream",
  sandbox: "read_only",
  status: "draft" as const,
  title: "Task title",
  updated_at: "2026-06-22T10:00:00Z",
  workspace_id: "workspace_1",
};

const expectedTask = {
  approvalPolicy: "never",
  assignedExecutorWidgetId: "executor_widget_1",
  codexExecutable: "codex.cmd",
  context: undefined,
  createdAt: "2026-06-22T10:00:00Z",
  dependsOn: ["task_upstream"],
  description: "Task description",
  executionPolicy: "manual",
  executionWorkspace: "C:/repo",
  priority: 1,
  prompt: "Task prompt",
  queueItemId: "task_downstream",
  sandbox: "read_only",
  status: "draft",
  title: "Task title",
  updatedAt: "2026-06-22T10:00:00Z",
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

  it("materializes workflow task slots through the typed Tauri command", async () => {
    mocks.invoke.mockResolvedValueOnce({
      action: null,
      binding: {
        create_task_action_id: "workflow_action_create",
        create_task_action_idempotency_key:
          "workflow_run_1:create_task:downstream:task-spec-hash",
        dependency_edge_hash: "dependency-edge-hash",
        dependency_spec_hash: "dependency-spec-hash",
        dependency_task_ids: ["task_upstream"],
        depends_on_slots: ["upstream"],
        slot: "downstream",
        task_id: "task_downstream",
        task_spec_hash: "task-spec-hash",
      },
      blocker: null,
      conflict: null,
      status: "created",
      task: tauriTask,
      workflow_run: tauriRun,
    });

    await expect(
      materializeAgentQueueWorkflowTaskSlot({
        actionIdempotencyKey: "workflow_run_1:create_task:downstream:hash",
        actorId: "workspace-agent",
        dependsOnSlots: ["upstream"],
        slot: "downstream",
        taskSpec: {
          priority: 1,
          prompt: "Task prompt",
          status: "draft",
          title: "Task title",
        },
        taskSpecHash: "task-spec-hash",
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toMatchObject({
      binding: {
        dependencyTaskIds: ["task_upstream"],
        dependsOnSlots: ["upstream"],
        slot: "downstream",
        taskId: "task_downstream",
        taskSpecHash: "task-spec-hash",
      },
      status: "created",
      task: expectedTask,
      workflowRun: expectedRun,
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "materialize_agent_queue_workflow_task_slot",
      {
        request: {
          action_idempotency_key: "workflow_run_1:create_task:downstream:hash",
          actor_id: "workspace-agent",
          depends_on_slots: ["upstream"],
          slot: "downstream",
          task_spec: {
            description: null,
            priority: 1,
            prompt: "Task prompt",
            status: "draft",
            title: "Task title",
          },
          task_spec_hash: "task-spec-hash",
          workflow_run_id: "workflow_run_1",
          workspace_id: "workspace_1",
        },
      },
    );
  });

  it("applies workflow run settings through the typed Tauri command", async () => {
    mocks.invoke.mockResolvedValueOnce({
      action: null,
      binding: {
        executor_widget_id: "executor_widget_1",
        settings_hash: "settings-hash",
        slot: "upstream",
        task_id: "task_upstream",
        update_run_settings_action_id: "workflow_action_settings",
        update_run_settings_action_idempotency_key:
          "workflow_run_1:update_run_settings:upstream:settings-hash",
      },
      blocker: null,
      conflict: null,
      status: "applied",
      task: { ...tauriTask, queue_item_id: "task_upstream", depends_on: [] },
      workflow_run: tauriRun,
    });

    await expect(
      applyAgentQueueWorkflowRunSettings({
        actorId: "workspace-agent",
        runSettings: {
          approvalPolicy: "never",
          codexExecutable: "codex.cmd",
          executionPolicy: "manual",
          executionWorkspace: "C:/repo",
          executorWidgetId: "executor_widget_1",
          sandbox: "read_only",
        },
        settingsHash: "settings-hash",
        slot: "upstream",
        taskId: "task_upstream",
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toMatchObject({
      binding: {
        executorWidgetId: "executor_widget_1",
        settingsHash: "settings-hash",
        slot: "upstream",
        taskId: "task_upstream",
      },
      status: "applied",
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "apply_agent_queue_workflow_run_settings",
      {
        request: {
          action_idempotency_key: null,
          actor_id: "workspace-agent",
          run_settings: {
            approval_policy: "never",
            codex_executable: "codex.cmd",
            execution_policy: "manual",
            execution_workspace: "C:/repo",
            executor_widget_id: "executor_widget_1",
            sandbox: "read_only",
          },
          settings_hash: "settings-hash",
          slot: "upstream",
          task_id: "task_upstream",
          workflow_run_id: "workflow_run_1",
          workspace_id: "workspace_1",
        },
      },
    );
  });

  it("promotes workflow task slots through the typed Tauri command", async () => {
    mocks.invoke.mockResolvedValueOnce({
      action: null,
      binding: {
        promote_action_id: "workflow_action_promote",
        promote_action_idempotency_key:
          "workflow_run_1:promote_task:upstream:task-spec-hash:settings-hash",
        promoted: true,
        settings_hash: "settings-hash",
        slot: "upstream",
        task_id: "task_upstream",
        task_spec_hash: "task-spec-hash",
        task_status: "queued",
      },
      blocker: null,
      conflict: null,
      status: "promoted",
      task: { ...tauriTask, queue_item_id: "task_upstream", status: "queued" },
      workflow_run: tauriRun,
    });

    await expect(
      promoteAgentQueueWorkflowTaskSlot({
        settingsHash: "settings-hash",
        slot: "upstream",
        taskId: "task_upstream",
        taskSpecHash: "task-spec-hash",
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toMatchObject({
      binding: {
        promoted: true,
        settingsHash: "settings-hash",
        slot: "upstream",
        taskId: "task_upstream",
        taskSpecHash: "task-spec-hash",
        taskStatus: "queued",
      },
      status: "promoted",
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "promote_agent_queue_workflow_task_slot",
      {
        request: {
          action_idempotency_key: null,
          actor_id: null,
          settings_hash: "settings-hash",
          slot: "upstream",
          task_id: "task_upstream",
          task_spec_hash: "task-spec-hash",
          workflow_run_id: "workflow_run_1",
          workspace_id: "workspace_1",
        },
      },
    );
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

  it("records queueWorkflow runner reports through the Tauri command", async () => {
    const tauriAction = {
      action_id: "action_1",
      action_type: "queue.review.createMessage",
      attempt_count: 1,
      blocker_code: null,
      blocker_message: null,
      completed_at: "2026-06-22T10:01:00Z",
      created_at: "2026-06-22T10:00:30Z",
      idempotency_key:
        "workflow_run_1:queue.review.createMessage:task_1:run_1",
      result_refs_json: "{\"messageId\":\"message_1\"}",
      started_at: "2026-06-22T10:00:30Z",
      status: "completed",
      step_id: "review.create",
      target_refs_json: "{\"taskId\":\"task_1\",\"runId\":\"run_1\"}",
      updated_at: "2026-06-22T10:01:00Z",
      workflow_run_id: "workflow_run_1",
      workspace_id: "workspace_1",
    };
    mocks.invoke.mockResolvedValueOnce({
      actions: [tauriAction],
      blocker: null,
      conflict: null,
      status: "recorded",
      workflow_run: { ...tauriRun, status: "paused" },
    });

    await expect(
      recordAgentQueueWorkflowRunnerReport({
        actionLogSummary: { runnerStatus: "completed" },
        actions: [
          {
            actionType: "queue.review.createMessage",
            idempotencyKey:
              "workflow_run_1:queue.review.createMessage:task_1:run_1",
            resultRefs: { messageId: "message_1" },
            status: "completed",
            stepId: "review.create",
            targetRefs: { taskId: "task_1", runId: "run_1" },
          },
        ],
        currentStep: "review_ack",
        idempotencyKeys: {
          reviewCreate:
            "workflow_run_1:queue.review.createMessage:task_1:run_1",
        },
        mutationRefs: { messageId: "message_1" },
        phase: "review",
        slotBindings: { upstream: { taskId: "task_1" } },
        status: "paused",
        variables: { workflowId: "dependency_acceptance_smoke" },
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      actions: [
        {
          actionId: "action_1",
          actionType: "queue.review.createMessage",
          attemptCount: 1,
          blockerCode: null,
          blockerMessage: null,
          completedAt: "2026-06-22T10:01:00Z",
          createdAt: "2026-06-22T10:00:30Z",
          idempotencyKey:
            "workflow_run_1:queue.review.createMessage:task_1:run_1",
          resultRefsJson: "{\"messageId\":\"message_1\"}",
          startedAt: "2026-06-22T10:00:30Z",
          status: "completed",
          stepId: "review.create",
          targetRefsJson: "{\"taskId\":\"task_1\",\"runId\":\"run_1\"}",
          updatedAt: "2026-06-22T10:01:00Z",
          workflowRunId: "workflow_run_1",
          workspaceId: "workspace_1",
        },
      ],
      blocker: null,
      conflict: null,
      status: "recorded",
      workflowRun: { ...expectedRun, status: "paused" },
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "record_agent_queue_workflow_runner_report",
      {
        request: {
          action_log_summary: { runnerStatus: "completed" },
          actions: [
            {
              action_type: "queue.review.createMessage",
              blocker_code: null,
              blocker_message: null,
              idempotency_key:
                "workflow_run_1:queue.review.createMessage:task_1:run_1",
              result_refs: { messageId: "message_1" },
              status: "completed",
              step_id: "review.create",
              target_refs: { taskId: "task_1", runId: "run_1" },
            },
          ],
          blocker_reason: null,
          current_step: "review_ack",
          idempotency_keys: {
            reviewCreate:
              "workflow_run_1:queue.review.createMessage:task_1:run_1",
          },
          mutation_refs: { messageId: "message_1" },
          pause_reason: null,
          phase: "review",
          slot_bindings: { upstream: { taskId: "task_1" } },
          status: "paused",
          variables: { workflowId: "dependency_acceptance_smoke" },
          workflow_run_id: "workflow_run_1",
          workspace_id: "workspace_1",
        },
      },
    );
  });

  it("records queueWorkflow worker evidence through the typed Tauri command", async () => {
    mocks.invoke.mockResolvedValueOnce({
      action: null,
      aggregate: null,
      binding: {
        evidence_action_id: "action_evidence_1",
        evidence_action_idempotency_key:
          "workflow_run_1:record_worker_evidence:upstream:task_1:run_1",
        evidence_bundle_id: "bundle_1",
        evidence_recorded_at: "2026-06-22T10:02:00Z",
        run_id: "run_1",
        slot: "upstream",
        task_id: "task_1",
        worker_final_status: "completed",
        worker_outcome: "completed",
      },
      blocker: null,
      conflict: null,
      evidence_bundle: {
        bundle_id: "bundle_1",
        changed_files: ["src/file.ts"],
        changed_files_count: 1,
        changed_files_summary: "1 file changed",
        created_at: "2026-06-22T10:02:00Z",
        error_summary: null,
        executor_widget_id: "executor_1",
        metadata_json: null,
        outcome: "completed",
        run_id: "run_1",
        run_link_id: "link_1",
        source: "workspace_agent",
        summary: "Worker completed.",
        task_id: "task_1",
        updated_at: "2026-06-22T10:02:00Z",
        validation_summary: null,
        worker_id: "workspace-agent",
        workspace_id: "workspace_1",
      },
      status: "recorded",
      workflow_run: { ...tauriRun, current_step: "awaiting_review" },
    });

    await expect(
      recordAgentQueueWorkflowWorkerEvidence({
        actionIdempotencyKey:
          "workflow_run_1:record_worker_evidence:upstream:task_1:run_1",
        changedFiles: ["src/file.ts"],
        changedFilesSummary: "1 file changed",
        outcome: "completed",
        runId: "run_1",
        slot: "upstream",
        summary: "Worker completed.",
        taskId: "task_1",
        workflowRunId: "workflow_run_1",
        workspaceId: "workspace_1",
        workerId: "workspace-agent",
      }),
    ).resolves.toMatchObject({
      binding: {
        evidenceActionId: "action_evidence_1",
        evidenceBundleId: "bundle_1",
        runId: "run_1",
        slot: "upstream",
        taskId: "task_1",
      },
      evidenceBundle: {
        bundleId: "bundle_1",
        changedFiles: ["src/file.ts"],
        taskId: "task_1",
      },
      status: "recorded",
      workflowRun: { ...expectedRun, currentStep: "awaiting_review" },
    });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "record_agent_queue_workflow_worker_evidence",
      {
        request: {
          action_idempotency_key:
            "workflow_run_1:record_worker_evidence:upstream:task_1:run_1",
          actor_id: null,
          changed_files: ["src/file.ts"],
          changed_files_summary: "1 file changed",
          error_summary: null,
          finished_at: null,
          metadata_json: null,
          outcome: "completed",
          run_id: "run_1",
          slot: "upstream",
          source: null,
          summary: "Worker completed.",
          task_id: "task_1",
          validation_summary: null,
          worker_id: "workspace-agent",
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
