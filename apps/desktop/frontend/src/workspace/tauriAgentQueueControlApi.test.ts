import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

import {
  getAgentQueueControlState,
  setAgentQueueControlState,
} from "./tauriAgentQueueControlApi";

const tauriControlState = {
  created_at: "2026-06-22T10:00:00Z",
  reason: "manual enable",
  status: "manual_enabled" as const,
  updated_at: "2026-06-22T10:01:00Z",
  updated_by_actor_id: "workspace-agent",
  version: 2,
  workspace_id: "workspace_1",
};

const expectedControlState = {
  createdAt: "2026-06-22T10:00:00Z",
  reason: "manual enable",
  status: "manual_enabled",
  updatedAt: "2026-06-22T10:01:00Z",
  updatedByActorId: "workspace-agent",
  version: 2,
  workspaceId: "workspace_1",
};

describe("queue control Tauri API wrapper", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("gets backend-owned Queue control state", async () => {
    mocks.invoke.mockResolvedValueOnce(tauriControlState);

    await expect(
      getAgentQueueControlState({ workspaceId: "workspace_1" }),
    ).resolves.toEqual(expectedControlState);

    expect(mocks.invoke).toHaveBeenCalledWith("get_agent_queue_control_state", {
      request: {
        workspace_id: "workspace_1",
      },
    });
  });

  it("sets backend-owned Queue control state with typed conflict details", async () => {
    mocks.invoke.mockResolvedValueOnce({
      blocker: {
        actual_version: 2,
        blocker_code: "version_conflict",
        blocker_message: "Queue control state version conflict.",
        expected_version: 1,
        missing_required_field: null,
      },
      control_state: tauriControlState,
      status: "version_conflict",
    });

    await expect(
      setAgentQueueControlState({
        actorId: "workspace-agent",
        expectedVersion: 1,
        reason: "manual enable",
        status: "manual_enabled",
        workspaceId: "workspace_1",
      }),
    ).resolves.toEqual({
      blocker: {
        actualVersion: 2,
        blockerCode: "version_conflict",
        blockerMessage: "Queue control state version conflict.",
        expectedVersion: 1,
        missingRequiredField: null,
      },
      controlState: expectedControlState,
      status: "version_conflict",
    });

    expect(mocks.invoke).toHaveBeenCalledWith("set_agent_queue_control_state", {
      request: {
        actor_id: "workspace-agent",
        expected_version: 1,
        reason: "manual enable",
        status: "manual_enabled",
        workspace_id: "workspace_1",
      },
    });
  });
});
