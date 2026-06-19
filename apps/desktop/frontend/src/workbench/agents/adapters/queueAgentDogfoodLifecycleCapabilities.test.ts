import { describe, expect, it } from "vitest";

import lifecycleCapabilitySource from "./queueAgentDogfoodLifecycleCapabilities.ts?raw";
import lifecycleControllerSource from "./queueAgentDogfoodLifecycleController.ts?raw";
import lifecycleManifestSource from "../capabilities/queueDogfoodLifecycleCapabilityManifest.ts?raw";
import {
  createActionRequest,
  createHobitAgentActionBroker,
  readHobitAgentActionRequestEnvelope,
} from "../broker";
import {
  createHobitAgentCapabilityRegistry,
  findCapability,
  HOBIT_AGENT_INITIAL_CAPABILITIES,
  type HobitAgentCapability,
} from "../capabilities";
import {
  buildQueueCapabilityNextAction,
  QUEUE_CAPABILITY_CONTRACT_BY_ID,
  queueCapabilityNextActionAgreesWithSuggestion,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
  validateQueueCapabilityNextAction,
} from "../capabilities/queueCapabilityContracts";
import { HOBIT_TEST_AGENT_CAPABILITIES } from "../runtime";
import {
  acknowledgeReviewMessage,
  canStartDependentAfterReviewGate,
  completeAgentPrompt,
  createDogfoodLifecycleItem,
  createReviewMessage,
  queueDogfoodLifecycleItem,
  startQueueItemRun,
  type SmartQueueDogfoodLifecycleItem,
  type SmartQueueLifecycleTransitionResult,
} from "../../queue/smartQueueDogfoodLifecycle";
import {
  createQueueWorkerEvidenceBundle,
} from "../../queue/smartQueueWorkerEvidenceBundle";
import { createDefaultQueueAgentAdapterApi } from "./queueAgentCapabilities";
import { createQueueAgentActionHandlers } from "./queueAgentActionHandlers";
import { createInMemoryQueueDogfoodLifecycleAdapterApi } from "./queueAgentDogfoodLifecycleController";
import {
  QUEUE_AGENT_CAPABILITY_IDS,
  type QueueAgentAdapterApi,
} from "./queueAgentCapabilityTypes";

const NOW = "2026-06-16T12:00:00.000Z";

const LIFECYCLE_CAPABILITY_IDS = [
  "queue.lifecycle.agentFinished",
  "queue.review.createMessage",
  "queue.review.ack",
  "queue.coordinator.approveValidation",
  "queue.coordinator.addFollowUpPrompt",
  "queue.item.markDone",
  "queue.item.block",
  "queue.item.fail",
  "queue.lifecycle.get",
  "queue.review.getEvidenceBundle",
] as const;

describe("queue dogfood lifecycle Action Broker capabilities", () => {
  it("lists lifecycle capabilities with schemas and valid action-request examples", () => {
    const registry = createHobitAgentCapabilityRegistry([
      ...HOBIT_TEST_AGENT_CAPABILITIES,
      ...HOBIT_AGENT_INITIAL_CAPABILITIES,
    ]);

    for (const capabilityId of LIFECYCLE_CAPABILITY_IDS) {
      expect(QUEUE_AGENT_CAPABILITY_IDS).toContain(capabilityId);

      const capability = requiredCapability(registry, capabilityId);
      expect(capability).toMatchObject({
        availability: { status: "available" },
        ownerSurface: "Agent Queue",
        supportsDryRun: capabilityId === "queue.item.markDone" ? false : true,
      });
      expect(capability.inputSchema?.requiredFields).toBeDefined();
      expect(capability.forbiddenSideEffects).toEqual(
        expect.arrayContaining([
          "git_mutation",
          "worker_start",
          "worker_auto_run",
          "validation_execution",
          "real_commit_execution",
          "rollback_execution",
          "terminal_launch",
          "codex_run",
          "shell_command",
        ]),
      );
      if (
        capabilityId !== "queue.lifecycle.agentFinished" &&
        capabilityId !== "queue.review.getEvidenceBundle" &&
        capabilityId !== "queue.review.createMessage" &&
        capabilityId !== "queue.review.ack" &&
        capabilityId !== "queue.item.markDone"
      ) {
        expect(capability.forbiddenSideEffects).toEqual(
          expect.arrayContaining(["backend_durability"]),
        );
      }

      for (const example of capability.examples ?? []) {
        const parsed = readHobitAgentActionRequestEnvelope(
          JSON.stringify(example.exampleActionRequest),
        );
        expect(parsed).toMatchObject({
          envelope: {
            capabilityId,
            type: "hobit.action.request",
          },
          status: "valid",
        });
      }
    }
  });

  it("documents required lifecycle fields without unsupported action fields", () => {
    const registry = createHobitAgentCapabilityRegistry();

    expect(
      requiredCapability(
        registry,
        "queue.lifecycle.agentFinished",
      ).inputSchema,
    ).toMatchObject({
      acceptedFields: expect.arrayContaining([
        "taskId",
        "runId",
        "outcome",
        "finalAgentMessage",
        "evidenceBundle",
        "threadId",
      ]),
      requiredFields: [
        "taskId or evidenceBundle.taskId",
        "runId or evidenceBundle.runId",
      ],
    });
    expect(
      requiredCapability(registry, "queue.review.ack").inputSchema,
    ).toMatchObject({
      requiredFields: ["taskId", "messageId"],
    });
    expect(
      requiredCapability(registry, "queue.review.createMessage").inputSchema,
    ).toMatchObject({
      acceptedFields: expect.arrayContaining([
        "taskId",
        "runId",
        "evidenceBundleId",
      ]),
      requiredFields: ["taskId"],
    });
    expect(
      requiredCapability(registry, "queue.item.markDone").inputSchema,
    ).toMatchObject({
      acceptedFields: expect.arrayContaining([
        "taskId",
        "reason",
        "runId",
        "reviewMessageId",
      ]),
      requiredFields: ["taskId", "top-level confirmationToken"],
    });
    expect(
      requiredCapability(registry, "queue.lifecycle.get").inputSchema,
    ).toMatchObject({
      acceptedFields: ["taskId"],
      requiredFields: ["taskId"],
    });

    for (const capabilityId of LIFECYCLE_CAPABILITY_IDS) {
      const acceptedFields =
        requiredCapability(registry, capabilityId).inputSchema?.acceptedFields ??
        [];
      expect(acceptedFields).not.toContain("operatorPrompt");
      expect(acceptedFields).not.toContain("naturalLanguagePrompt");
      expect(acceptedFields).not.toContain("executeCommit");
      expect(acceptedFields).not.toContain("runWorker");
      expect(acceptedFields).not.toContain("rollback");
      expect(acceptedFields).not.toContain("terminalCommand");
    }
  });

  it("documents lifecycle backing, id requirements, and continuation policy in the Queue contract inventory", () => {
    const backendBackedCapabilities = [
      "queue.lifecycle.agentFinished",
      "queue.lifecycle.get",
      "queue.item.markDone",
      "queue.review.ack",
      "queue.review.createMessage",
      "queue.review.getEvidenceBundle",
    ];
    const transitionalCapabilities = [
      "queue.coordinator.approveValidation",
      "queue.coordinator.addFollowUpPrompt",
      "queue.item.block",
      "queue.item.fail",
    ];

    for (const capabilityId of backendBackedCapabilities) {
      expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId)).toMatchObject({
        backing: "backend_backed",
        implemented: true,
        registered: true,
      });
    }

    expect(
      QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.review.getEvidenceBundle"),
    ).toMatchObject({
      autoContinuationSafe: true,
      readOnly: true,
      requiredIds: {
        taskId: true,
      },
      sideEffectLevel: "read",
    });
    expect(
      QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.lifecycle.agentFinished"),
    ).toMatchObject({
      requiredIds: {
        runId: true,
        taskId: true,
      },
    });
    expect(
      QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.review.ack"),
    ).toMatchObject({
      autoContinuationSafe: true,
      requiredIds: {
        messageId: true,
        taskId: true,
      },
    });
    expect(
      QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.review.createMessage"),
    ).toMatchObject({
      autoContinuationSafe: false,
      backing: "backend_backed",
      requiredIds: {
        taskId: true,
      },
    });
    expect(
      QUEUE_CAPABILITY_CONTRACT_BY_ID.get("queue.item.markDone"),
    ).toMatchObject({
      autoContinuationSafe: false,
      backing: "backend_backed",
      confirmation: {
        required: true,
        value: QUEUE_START_RUN_CONFIRMATION_TOKEN,
      },
      confirmationRequirement: "required",
      requiredIds: {
        taskId: true,
      },
    });

    for (const capabilityId of transitionalCapabilities) {
      expect(QUEUE_CAPABILITY_CONTRACT_BY_ID.get(capabilityId)).toMatchObject({
        autoContinuationSafe: false,
        backing: "transitional_frontend_overlay",
        confirmationRequirement: "recommended",
        registered: true,
      });
    }
  });

  it("validates typed Queue nextAction payloads against canonical capability schemas", () => {
    const ack = buildQueueCapabilityNextAction({
      capabilityId: "queue.review.ack",
      input: { messageId: "review-message-1", taskId: "task-1" },
      reason: "Duplicate review message can be acknowledged.",
    });

    expect(ack).toMatchObject({
      nextAction: {
        autoContinuationSafe: true,
        capabilityId: "queue.review.ack",
        input: {
          messageId: "review-message-1",
          taskId: "task-1",
        },
        requiresConfirmation: false,
      },
      ok: true,
    });
    if (!ack.ok) {
      throw new Error("Expected ACK nextAction to validate.");
    }
    expect(
      queueCapabilityNextActionAgreesWithSuggestion({
        nextAction: ack.nextAction,
        nextSuggestedCapability: "queue.review.ack",
      }),
    ).toBe(true);
    expect(
      queueCapabilityNextActionAgreesWithSuggestion({
        nextAction: ack.nextAction,
        nextSuggestedCapability: "queue.review.createMessage",
      }),
    ).toBe(false);

    expect(
      validateQueueCapabilityNextAction({
        ...ack.nextAction,
        input: { reviewMessageId: "review-message-1", taskId: "task-1" },
      }),
    ).toMatchObject({
      missingRequiredFields: ["messageId"],
      ok: false,
      reasons: expect.arrayContaining([
        "reviewMessageId is not supported by queue.review.ack.",
        "messageId is required by queue.review.ack.",
      ]),
    });
    expect(
      validateQueueCapabilityNextAction({
        ...ack.nextAction,
        capabilityId: "queue.review.unregistered",
      }),
    ).toMatchObject({
      ok: false,
      reasons: [
        "nextAction capability is not registered: queue.review.unregistered.",
      ],
    });
    expect(
      buildQueueCapabilityNextAction({
        capabilityId: "queue.item.updateRunSettings",
        input: { sandbox: "workspace-write", taskId: "task-1" },
      }),
    ).toMatchObject({
      ok: false,
      reason:
        "sandbox must be one of read_only, workspace_write, danger_full_access for queue.item.updateRunSettings.",
    });
    expect(
      buildQueueCapabilityNextAction({
        capabilityId: "queue.item.markDone",
        input: { taskId: "task-1" },
      }),
    ).toMatchObject({
      nextAction: {
        autoContinuationSafe: false,
        confirmationRequired: {
          field: "confirmationToken",
          value: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        },
        requiresConfirmation: true,
      },
      ok: true,
    });
  });

  it("dry-runs agentFinished without mutating the lifecycle overlay", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: true,
        input: agentFinishedInput(),
      }),
    );

    expect(result.status, result.result.message).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      agentPromptState: "completed",
      dryRunOnly: true,
      previousTicketState: "running",
      queueMutation: "none",
      ticketState: "awaiting_review",
      wouldAutoRunWorkers: false,
      wouldCallGit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldPersistBackend: false,
      wouldRunValidation: false,
      wouldStartWorkers: false,
    });

    const read = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.get",
        dryRun: true,
        input: { taskId: "task-1" },
      }),
    );
    expect(outputOf(read).lifecycle).toMatchObject({
      agentPromptState: "running",
      ticketState: "running",
    });
  });

  it("applies agentFinished from running to awaiting review", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: agentFinishedInput(),
      }),
    );

    expect(result.status, result.result.message).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      previousTicketState: "running",
      queueMutation: "frontend_controller_overlay",
      reviewOutcome: "completed",
      ticketState: "awaiting_review",
    });

    const read = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.get",
        dryRun: true,
        input: { taskId: "task-1" },
      }),
    );
    expect(outputOf(read).lifecycle).toMatchObject({
      finalAgentMessage: "Implemented the requested changes.",
      ticketState: "awaiting_review",
    });
  });

  it("applies agentFinished from a worker evidence bundle and stores normalized evidence", () => {
    const evidenceBundle = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: ["apps/desktop/frontend/src/workbench/queue/evidence.ts"],
      finalAgentMessage: "Implemented the requested changes.",
      logReference: "frontend://logs/attempt-1",
      outcome: "completed",
      runId: "run-1",
      taskId: "task-1",
      threadId: "thread-1",
      validationOutputPreview: "typecheck passed",
      validationStatus: "passed",
      validationSummary: "typecheck passed",
    });
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: { evidenceBundle },
      }),
    );

    expect(result.status, result.result.message).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      reviewOutcome: "completed",
      ticketState: "awaiting_review",
    });
    expect(outputOf(result).lifecycle).toMatchObject({
      currentThreadId: "thread-1",
      finalAgentMessage: "Implemented the requested changes.",
      workerEvidenceBundle: {
        logReference: "frontend://logs/attempt-1",
        taskId: "task-1",
        threadId: "thread-1",
      },
      workerEvidenceSummary: {
        outcomeLabel: "Agent completed",
        validationLabel: "Validation passed",
      },
    });
  });

  it("rejects invalid or mismatched worker evidence bundles before lifecycle mutation", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });
    const mismatched = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: [],
      finalAgentMessage: "Done.",
      outcome: "completed",
      runId: "run-1",
      taskId: "task-other",
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: {
          evidenceBundle: mismatched,
          taskId: "task-1",
        },
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe(
      "Evidence bundle taskId does not match the action input taskId.",
    );
    expect(
      outputOf(
        broker.invoke(
          request({
            capabilityId: "queue.lifecycle.get",
            dryRun: true,
            input: { taskId: "task-1" },
          }),
        ),
      ).lifecycle,
    ).toMatchObject({
      ticketState: "running",
    });
  });

  it("creates review messages only from awaiting review", () => {
    const runningBroker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });
    const failed = runningBroker.invoke(
      request({
        capabilityId: "queue.review.createMessage",
        input: {
          coordinatorAgentId: "workspace-agent",
          taskId: "task-1",
        },
      }),
    );

    expect(failed.status).toBe("failed");
    expect(failed.result.message).toContain("createReviewMessage cannot run");

    const awaitingBroker = lifecycleBroker({
      initialLifecycles: [awaitingReviewItem()],
    });
    const created = awaitingBroker.invoke(
      request({
        capabilityId: "queue.review.createMessage",
        input: {
          coordinatorAgentId: "workspace-agent",
          messageId: "review-message-1",
          taskId: "task-1",
        },
      }),
    );

    expect(created.status).toBe("succeeded");
    expect(created.result.output).toMatchObject({
      ticketState: "awaiting_review",
      value: {
        finalAgentMessage: "Implemented the requested changes.",
        messageId: "review-message-1",
        toCoordinatorAgentId: "workspace-agent",
      },
    });
  });

  it("includes worker evidence summary in review messages and evidence bundle reads", () => {
    const evidenceBundle = createQueueWorkerEvidenceBundle({
      attemptId: "attempt-1",
      changedFiles: ["apps/desktop/frontend/src/workbench/queue/evidence.ts"],
      finalAgentMessage: "Implemented the requested changes.",
      logReference: "frontend://logs/attempt-1",
      outcome: "completed",
      runId: "run-1",
      taskId: "task-1",
      threadId: "thread-1",
      validationStatus: "passed",
      validationSummary: "typecheck passed",
    });
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });

    broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: { evidenceBundle },
      }),
    );
    const created = broker.invoke(
      request({
        capabilityId: "queue.review.createMessage",
        input: {
          coordinatorAgentId: "workspace-agent",
          messageId: "review-message-1",
          taskId: "task-1",
        },
      }),
    );
    const evidence = broker.invoke(
      request({
        capabilityId: "queue.review.getEvidenceBundle",
        dryRun: true,
        input: { taskId: "task-1" },
      }),
    );

    expect(created.status).toBe("succeeded");
    expect(outputOf(created).value).toMatchObject({
      evidenceSummary: expect.stringContaining("Evidence bundle is frontend-only"),
      workerEvidenceBundle: {
        taskId: "task-1",
        threadId: "thread-1",
      },
    });
    expect(evidence.status).toBe("succeeded");
    expect(evidence.result.output).toMatchObject({
      evidenceBundle: {
        logReference: "frontend://logs/attempt-1",
        taskId: "task-1",
      },
      evidenceBundlePersistence: "frontend_only_not_durable",
      evidenceSummary: {
        outcomeLabel: "Agent completed",
        validationLabel: "Validation passed",
      },
    });
  });

  it("acknowledges the correct review message into in review", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [reviewMessagedItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.review.ack",
        input: {
          coordinatorAgentId: "workspace-agent",
          messageId: "review-message-1",
          taskId: "task-1",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      previousTicketState: "awaiting_review",
      ticketState: "in_review",
      value: {
        coordinatorAgentId: "workspace-agent",
        messageId: "review-message-1",
      },
    });
  });

  it("fails review ACK for wrong message or task", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [reviewMessagedItem()],
    });

    const wrongMessage = broker.invoke(
      request({
        capabilityId: "queue.review.ack",
        input: {
          coordinatorAgentId: "workspace-agent",
          messageId: "missing-message",
          taskId: "task-1",
        },
      }),
    );
    expect(wrongMessage.status).toBe("failed");
    expect(wrongMessage.result.message).toContain(
      "review message was not found",
    );

    const wrongTask = broker.invoke(
      request({
        capabilityId: "queue.review.ack",
        input: {
          coordinatorAgentId: "workspace-agent",
          messageId: "review-message-1",
          taskId: "missing-task",
        },
      }),
    );
    expect(wrongTask.status).toBe("failed");
    expect(wrongTask.result.message).toContain("was not found");
  });

  it("records validation approval without marking done or running validation", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [inReviewItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.coordinator.approveValidation",
        input: {
          coordinatorAgentId: "workspace-agent",
          summary: "Validation approved by coordinator.",
          taskId: "task-1",
          validationApprovalId: "validation-1",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      ticketState: "in_review",
      value: {
        modelOnly: true,
        validationApprovalId: "validation-1",
      },
      wouldRunValidation: false,
    });
    expect(outputOf(result).lifecycle).toMatchObject({
      commitResults: [],
      ticketState: "in_review",
      validationApprovals: [
        {
          modelOnly: true,
          validationApprovalId: "validation-1",
        },
      ],
    });
  });

  it("adds a follow-up prompt and returns in-review work to running", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [inReviewItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.coordinator.addFollowUpPrompt",
        input: {
          coordinatorAgentId: "workspace-agent",
          prompt: "Continue in the same thread and fix validation.",
          taskId: "task-1",
          threadId: "thread-1",
        },
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      additionalPromptCount: 1,
      agentPromptState: "additional_prompt_running",
      previousTicketState: "in_review",
      ticketState: "running",
      wouldStartWorkers: false,
    });
    expect(outputOf(result).lifecycle.followUpPrompts).toHaveLength(1);
  });

  it("requires exact structured confirmation before markDone reaches backend", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [inReviewItem()],
    });

    const missingConfirmation = broker.invoke(
      request({
        capabilityId: "queue.item.markDone",
        input: {
          taskId: "task-1",
        },
      }),
    );

    expect(missingConfirmation.status).toBe("needs_confirmation");
    expect(missingConfirmation.result.message).toContain(
      "queue.item.markDone requires confirmation.",
    );

    const exactConfirmation = broker.invoke(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          reason: "Accepted by operator.",
          taskId: "task-1",
        },
      }),
    );

    expect(exactConfirmation.status).toBe("unavailable");
    expect(exactConfirmation.result.message).toBe(
      "Queue accepted completion is backend-owned and unavailable from the in-memory lifecycle controller.",
    );
  });

  it("keeps dependents gated until backend accepted completion", () => {
    const awaitingReview = awaitingReviewItem();
    const inReview = inReviewItem();

    expect(canStartDependentAfterReviewGate(awaitingReview)).toBe(false);
    expect(canStartDependentAfterReviewGate(inReview)).toBe(false);

    const broker = lifecycleBroker({ initialLifecycles: [inReview] });
    const result = broker.invoke(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          taskId: "task-1",
        },
      }),
    );

    expect(result.status).toBe("unavailable");
  });

  it("rejects old fake commit and validation markDone fields", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [inReviewItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.item.markDone",
        confirmationToken: QUEUE_START_RUN_CONFIRMATION_TOKEN,
        input: {
          commit: {
            commitHash: "fake-hash",
          },
          taskId: "task-1",
          validationApproved: true,
        },
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe(
      "commit is not supported by queue.item.markDone.",
    );
  });

  it("blocks and fails in-review items with visible reasons", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [inReviewItem("task-block"), inReviewItem("task-fail")],
    });

    const blocked = broker.invoke(
      request({
        capabilityId: "queue.item.block",
        input: {
          coordinatorAgentId: "workspace-agent",
          reason: "Needs product decision.",
          taskId: "task-block",
        },
      }),
    );
    const failed = broker.invoke(
      request({
        capabilityId: "queue.item.fail",
        input: {
          coordinatorAgentId: "workspace-agent",
          reason: "Validation cannot pass.",
          taskId: "task-fail",
        },
      }),
    );

    expect(blocked.status).toBe("succeeded");
    expect(blocked.result.output).toMatchObject({
      lifecycle: {
        blockedReason: "Needs product decision.",
      },
      ticketState: "blocked",
    });
    expect(failed.status).toBe("succeeded");
    expect(failed.result.output).toMatchObject({
      lifecycle: {
        failureReason: "Validation cannot pass.",
      },
      ticketState: "failure",
    });
  });

  it("returns unavailable when lifecycle controller dependencies are absent", () => {
    const adapter: QueueAgentAdapterApi = createDefaultQueueAgentAdapterApi();
    const broker = createHobitAgentActionBroker({
      handlers: createQueueAgentActionHandlers(adapter),
      policy: { requireDryRunBeforeSideEffectingInvoke: false },
      registry: createHobitAgentCapabilityRegistry([
        ...HOBIT_TEST_AGENT_CAPABILITIES,
        ...HOBIT_AGENT_INITIAL_CAPABILITIES,
      ]),
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: agentFinishedInput(),
      }),
    );

    expect(result.status).toBe("unavailable");
    expect(result.result.message).toBe(
      "Queue dogfood lifecycle controller is unavailable.",
    );
  });

  it("rejects invalid lifecycle input compactly", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });

    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        input: {
          finalAgentMessage: "Implemented.",
          outcome: "completed",
          runId: "run-1",
          taskId: "task-1",
          terminalCommand: "npm test",
        },
      }),
    );

    expect(result.status).toBe("invalid_input");
    expect(result.result.message).toBe(
      "terminalCommand is not supported by queue.lifecycle.agentFinished.",
    );
  });

  it("exposes safety outputs and does not add regex routing modules", () => {
    const broker = lifecycleBroker({
      initialLifecycles: [runningItem()],
    });
    const result = broker.invoke(
      request({
        capabilityId: "queue.lifecycle.agentFinished",
        dryRun: true,
        input: agentFinishedInput(),
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.result.output).toMatchObject({
      wouldAutoRunWorkers: false,
      wouldCallGit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldRunValidation: false,
      wouldStartWorkers: false,
    });

    for (const source of [
      lifecycleCapabilitySource,
      lifecycleControllerSource,
      lifecycleManifestSource,
    ]) {
      expect(source).not.toContain("new RegExp");
      expect(source).not.toContain(".match(");
    }
  });
});

function lifecycleBroker({
  initialLifecycles,
}: {
  initialLifecycles: readonly SmartQueueDogfoodLifecycleItem[];
}) {
  const adapter: QueueAgentAdapterApi = {
    ...createDefaultQueueAgentAdapterApi(),
    dogfoodLifecycle: createInMemoryQueueDogfoodLifecycleAdapterApi({
      initialLifecycles,
      now: () => NOW,
    }),
  };

  return createHobitAgentActionBroker({
    handlers: createQueueAgentActionHandlers(adapter),
    policy: { requireDryRunBeforeSideEffectingInvoke: false },
    registry: createHobitAgentCapabilityRegistry([
      ...HOBIT_TEST_AGENT_CAPABILITIES,
      ...HOBIT_AGENT_INITIAL_CAPABILITIES,
    ]),
  });
}

function request({
  capabilityId,
  confirmationToken,
  dryRun = false,
  input,
}: {
  capabilityId: string;
  confirmationToken?: string | null;
  dryRun?: boolean;
  input: unknown;
}) {
  return createActionRequest({
    agentId: "workspace-agent",
    agentRoleId: "workspace_agent",
    capabilityId,
    confirmationToken,
    createdAt: NOW,
    dryRun,
    input,
    requestId: `request-${capabilityId}`,
  });
}

function agentFinishedInput() {
  return {
    attemptId: "attempt-1",
    changedFilesSummary: ["apps/desktop/frontend/src/..."],
    finalAgentMessage: "Implemented the requested changes.",
    outcome: "completed",
    runId: "run-1",
    taskId: "task-1",
    validationSummary: "typecheck passed",
  };
}

function runningItem(taskId = "task-1") {
  const base = createDogfoodLifecycleItem({
    createdAt: "2026-06-16T11:00:00.000Z",
    originalPrompt: "Implement the request.",
    taskId,
    title: "Queue task",
  });
  const queued = mustItem(
    queueDogfoodLifecycleItem(base, "2026-06-16T11:01:00.000Z"),
  );

  return mustItem(
    startQueueItemRun(queued, {
      attemptId: "attempt-1",
      runnablePrompt: "Implement the request.",
      startedAt: "2026-06-16T11:02:00.000Z",
      threadId: "thread-1",
    }),
  );
}

function awaitingReviewItem(taskId = "task-1") {
  return mustItem(
    completeAgentPrompt(runningItem(taskId), {
      attemptId: "attempt-1",
      changedFilesSummary: "apps/desktop/frontend/src/...",
      completedAt: "2026-06-16T11:10:00.000Z",
      finalAgentMessage: "Implemented the requested changes.",
      validationSummary: "typecheck passed",
    }),
  );
}

function reviewMessagedItem(taskId = "task-1") {
  return mustItem(
    createReviewMessage(awaitingReviewItem(taskId), {
      createdAt: "2026-06-16T11:11:00.000Z",
      messageId: "review-message-1",
      toCoordinatorAgentId: "workspace-agent",
    }),
  );
}

function inReviewItem(taskId = "task-1") {
  return mustItem(
    acknowledgeReviewMessage(reviewMessagedItem(taskId), {
      ackId: "ack-1",
      coordinatorAgentId: "workspace-agent",
      messageId: "review-message-1",
      receivedAt: "2026-06-16T11:12:00.000Z",
    }),
  );
}

function mustItem<TPayload>(
  result: SmartQueueLifecycleTransitionResult<TPayload>,
) {
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Lifecycle seed failed.");
  }

  return result.item;
}

function outputOf(result: { result: { output?: unknown } }) {
  return result.result.output as {
    lifecycle: SmartQueueDogfoodLifecycleItem;
    [key: string]: unknown;
  };
}

function requiredCapability(
  registry: ReturnType<typeof createHobitAgentCapabilityRegistry>,
  capabilityId: string,
): HobitAgentCapability {
  const capability = findCapability(registry, capabilityId);
  if (!capability) {
    throw new Error(`Missing capability ${capabilityId}`);
  }

  return capability;
}
