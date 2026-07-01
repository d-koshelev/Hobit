import { describe, expect, it } from "vitest";

import {
  createHobitNextActionUnavailable,
  readHobitNextActionUnavailable,
  validateHobitNextAction,
} from "./nextAction";

describe("Hobit generic nextAction contract", () => {
  it("validates a registered generic Queue nextAction", () => {
    const validation = validateHobitNextAction({
      autoContinuationSafe: true,
      capabilityId: "queue.lifecycle.get",
      input: { taskId: "task-1" },
      moduleId: "queue",
      requiresConfirmation: false,
    });

    expect(validation).toMatchObject({
      capabilityId: "queue.lifecycle.get",
      moduleId: "queue",
      ok: true,
    });
  });

  it("rejects unknown capabilities and unknown module/capability pairs", () => {
    expect(
      validateHobitNextAction({
        autoContinuationSafe: true,
        capabilityId: "queue.unregistered",
        input: {},
        requiresConfirmation: false,
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "invalid_next_action_payload",
    });

    expect(
      validateHobitNextAction({
        autoContinuationSafe: true,
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-1" },
        moduleId: "unknown-module",
        requiresConfirmation: false,
      }),
    ).toMatchObject({
      moduleId: "unknown-module",
      ok: false,
    });

    const wrongModule = validateHobitNextAction({
      autoContinuationSafe: true,
      capabilityId: "agent.status.read",
      input: {},
      moduleId: "queue",
      requiresConfirmation: false,
    });

    expect(wrongModule).toMatchObject({
      capabilityId: "agent.status.read",
      moduleId: "queue",
      ok: false,
    });
    expect(wrongModule.reasons).toContain(
      "agent.status.read is not registered by module control surface queue.",
    );
  });

  it("rejects unsupported fields and invalid Queue enum values", () => {
    expect(
      validateHobitNextAction({
        autoContinuationSafe: true,
        capabilityId: "queue.lifecycle.get",
        input: { taskId: "task-1", title: "Do not infer from title" },
        moduleId: "queue",
        requiresConfirmation: false,
      }),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        "title is not supported by queue.lifecycle.get.",
      ]),
    });

    expect(
      validateHobitNextAction({
        autoContinuationSafe: true,
        capabilityId: "queue.item.updateRunSettings",
        input: { sandbox: "broad", taskId: "task-1" },
        moduleId: "queue",
        requiresConfirmation: false,
      }),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        "sandbox must be one of read_only, workspace_write, danger_full_access for queue.item.updateRunSettings.",
      ]),
    });
  });

  it("does not treat nextSuggestedCapability alone as executable", () => {
    const output = {
      nextSuggestedCapability: "queue.lifecycle.get",
    };

    expect("nextAction" in output).toBe(false);
    expect(readHobitNextActionUnavailable(output)).toBeNull();
    expect(validateHobitNextAction(undefined)).toMatchObject({
      ok: false,
      reasonCode: "invalid_next_action_payload",
    });
  });

  it("surfaces nextActionUnavailable and ambiguous metadata as non-executable", () => {
    const nextActionUnavailable = createHobitNextActionUnavailable({
      ambiguousCandidateIds: ["task-1", "task-2", "task-1"],
      reasonCode: "ambiguous_next_action",
      reasonMessage: "Multiple task ids require operator scoping.",
    });

    expect(nextActionUnavailable).toEqual({
      ambiguousCandidateIds: ["task-1", "task-2"],
      reasonCode: "ambiguous_next_action",
      reasonMessage: "Multiple task ids require operator scoping.",
    });
    expect(
      readHobitNextActionUnavailable({
        nextActionUnavailable,
        nextSuggestedCapability: "queue.item.updateRunSettings",
      }),
    ).toEqual(nextActionUnavailable);
  });

  it("does not infer missing ids from prose, titles, order, or target metadata", () => {
    const validation = validateHobitNextAction({
      autoContinuationSafe: true,
      capabilityId: "queue.lifecycle.get",
      input: {},
      moduleId: "queue",
      reasonMessage:
        "The next task is first in the UI order and the title says task-1.",
      requiresConfirmation: false,
      targetIds: { runId: "run-1" },
    });

    expect(validation).toMatchObject({
      missingRequiredInputs: ["taskId"],
      ok: false,
    });
    expect(validation.reasons).toContain(
      "taskId is required by queue.lifecycle.get.",
    );
  });
});
