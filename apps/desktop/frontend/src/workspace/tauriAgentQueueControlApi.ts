import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueControlCommandBlocker,
  AgentQueueControlState,
  GetAgentQueueControlStateRequest,
  SetAgentQueueControlStateRequest,
  SetAgentQueueControlStateResult,
} from "./types";

type TauriAgentQueueControlState = {
  workspace_id: string;
  status: AgentQueueControlState["status"];
  version: number;
  updated_by_actor_id: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

type TauriAgentQueueControlCommandBlocker = {
  blocker_code: string;
  blocker_message: string;
  expected_version: number | null;
  actual_version: number | null;
  missing_required_field: string | null;
};

type TauriSetAgentQueueControlStateResult = {
  status: SetAgentQueueControlStateResult["status"];
  control_state: TauriAgentQueueControlState | null;
  blocker: TauriAgentQueueControlCommandBlocker | null;
};

export async function getAgentQueueControlState(
  request: GetAgentQueueControlStateRequest,
): Promise<AgentQueueControlState | null> {
  const state = await invoke<TauriAgentQueueControlState | null>(
    "get_agent_queue_control_state",
    {
      request: {
        workspace_id: request.workspaceId,
      },
    },
  );

  return state ? normalizeAgentQueueControlState(state) : null;
}

export async function setAgentQueueControlState(
  request: SetAgentQueueControlStateRequest,
): Promise<SetAgentQueueControlStateResult> {
  const result = await invoke<TauriSetAgentQueueControlStateResult>(
    "set_agent_queue_control_state",
    {
      request: {
        actor_id: request.actorId ?? null,
        expected_version: request.expectedVersion ?? null,
        reason: request.reason ?? null,
        status: request.status,
        workspace_id: request.workspaceId,
      },
    },
  );

  return normalizeSetAgentQueueControlStateResult(result);
}

export function normalizeAgentQueueControlState(
  state: TauriAgentQueueControlState,
): AgentQueueControlState {
  return {
    workspaceId: state.workspace_id,
    status: state.status,
    version: state.version,
    updatedByActorId: state.updated_by_actor_id,
    reason: state.reason,
    createdAt: state.created_at,
    updatedAt: state.updated_at,
  };
}

function normalizeSetAgentQueueControlStateResult(
  result: TauriSetAgentQueueControlStateResult,
): SetAgentQueueControlStateResult {
  return {
    status: result.status,
    controlState: result.control_state
      ? normalizeAgentQueueControlState(result.control_state)
      : null,
    blocker: result.blocker ? normalizeBlocker(result.blocker) : null,
  };
}

function normalizeBlocker(
  blocker: TauriAgentQueueControlCommandBlocker,
): AgentQueueControlCommandBlocker {
  return {
    blockerCode: blocker.blocker_code,
    blockerMessage: blocker.blocker_message,
    expectedVersion: blocker.expected_version,
    actualVersion: blocker.actual_version,
    missingRequiredField: blocker.missing_required_field,
  };
}
