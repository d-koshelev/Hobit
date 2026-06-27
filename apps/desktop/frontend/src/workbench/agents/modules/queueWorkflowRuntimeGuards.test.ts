import facadeSource from "./queueWorkflowRunnerRuntimeAdapter.ts?raw";
import indexSource from "./queueWorkflowRuntimeAdapter/index.ts?raw";
import typesSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeAdapterTypes.ts?raw";
import activitySource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeActivity.ts?raw";
import backendStepsSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeBackendSteps.ts?raw";
import errorsSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeErrors.ts?raw";
import guardsSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeGuards.ts?raw";
import persistenceSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimePersistence.ts?raw";
import projectionSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeProjection.ts?raw";
import readOnlySource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeReadOnly.ts?raw";
import requestSource from "./queueWorkflowRuntimeAdapter/queueWorkflowRuntimeRequest.ts?raw";

import { describe, expect, it } from "vitest";

const runtimeAdapterSources = [
  facadeSource,
  indexSource,
  typesSource,
  activitySource,
  backendStepsSource,
  errorsSource,
  guardsSource,
  persistenceSource,
  projectionSource,
  readOnlySource,
  requestSource,
].join("\n");

describe("QueueWorkflowRuntime source guards", () => {
  it("keeps runtime adapter modules free of Queue UI, visual shell, shell, Git, Terminal, validation, and rollback imports", () => {
    for (const fragment of [
      "AgentQueueV2Board",
      "AgentQueuePlaceholderWidget",
      "widgetV2/queueV2",
      "queue/details",
      "QueueV2",
      "ModuleShell",
      "tokens.css",
      "widget.css",
      "Terminal",
      "Git",
      "runValidation",
      "rollback",
      "mutateGit",
    ]) {
      expect(runtimeAdapterSources).not.toContain(fragment);
    }
  });

  it("does not import or call raw workflow mutation bridge ports", () => {
    for (const fragment of [
      "materializeTaskSlot",
      "applyRunSettings",
      "promoteTaskSlot",
      "startWorkerForSlot",
      "recordWorkflowWorkerEvidence",
      "createReviewMessage",
      "ackReviewMessage",
      "markDone",
      "failItem",
      "materializeWorkflowTaskSlot",
      "applyWorkflowRunSettings",
      "promoteWorkflowTaskSlot",
      "startWorkflowAssignedTask",
    ]) {
      expect(runtimeAdapterSources).not.toContain(fragment);
    }
  });

  it("does not synthesize mutating workflow action rows in the runtime adapter path", () => {
    for (const fragment of [
      'actionType: "create_task"',
      'actionType: "update_run_settings"',
      'actionType: "promote_task"',
      'actionType: "start_worker"',
      'actionType: "record_worker_evidence"',
      'actionType: "create_review_message"',
      'actionType: "ack_review_message"',
      'actionType: "mark_done"',
      'actionType: "fail_item"',
      "create_task synthesis",
      "update_run_settings synthesis",
      "promote_task synthesis",
      "start_worker synthesis",
      "record_worker_evidence synthesis",
      "create_review_message synthesis",
      "ack_review_message synthesis",
      "mark_done/fail_item synthesis",
      "workflow terminal status calculation",
    ]) {
      expect(runtimeAdapterSources).not.toContain(fragment);
    }
  });

  it("does not expose raw mutating Queue capability ids from runtime adapter modules", () => {
    for (const fragment of [
      "queue.review.createMessage",
      "queue.review.ack",
      "queue.item.markDone",
      "queue.item.fail",
      "queue.lifecycle.agentFinished",
      "queue.item.startRun",
    ]) {
      expect(runtimeAdapterSources).not.toContain(fragment);
    }
  });
});
