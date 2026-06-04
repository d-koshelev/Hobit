import { describe, expect, it, vi } from "vitest";

import { runWorkspaceAgentQueueCommand } from "./workspaceAgentQueueCommandHandler";
import {
  autonomousResult,
  queueBridge,
} from "./workspaceAgentQueueCommandHandler.testHelpers";

describe("workspaceAgentQueueCommandHandler autonomous Queue commands", () => {
  it("starts Autonomous Queue through the autonomous bridge action", async () => {
    const runAutonomousQueue = vi.fn(async () =>
      autonomousResult("queue.runAutonomousQueue", {
        message: "Autonomous Queue started.",
        ok: true,
        status: "running",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand("run autonomous queue", {
      bridge: queueBridge({ runAutonomousQueue }),
    });

    expect(result.handled).toBe(true);
    expect(runAutonomousQueue).toHaveBeenCalledTimes(1);
    expect(result.body).toBe("Autonomous Queue started.");
  });

  it("stops Autonomous Queue after the current task through the autonomous bridge action", async () => {
    const stopAutonomousQueueAfterCurrent = vi.fn(async () =>
      autonomousResult("queue.stopAutonomousQueueAfterCurrent", {
        message: "Autonomous Queue will stop after the current task.",
        ok: true,
        status: "stopping",
      }),
    );

    const result = await runWorkspaceAgentQueueCommand(
      "stop after current task",
      {
        bridge: queueBridge({ stopAutonomousQueueAfterCurrent }),
      },
    );

    expect(result.handled).toBe(true);
    expect(stopAutonomousQueueAfterCurrent).toHaveBeenCalledTimes(1);
    expect(result.body).toBe(
      "Autonomous Queue will stop after the current task.",
    );
  });
});
