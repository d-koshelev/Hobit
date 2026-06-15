import type {
  HobitAgentCapability,
  HobitAgentCapabilityRegistry,
} from "../capabilities/types";
import type { HobitAgentRoleId } from "../context/types";
import {
  createAgentHistory,
  getBoundedAgentHistory,
  type HobitAgentHistory,
  type HobitAgentHistoryQuery,
  type HobitAgentHistoryResult,
} from "../messaging/hobitAgentMessaging";

export type HobitAgentId = string;
export type HobitAgentRole = HobitAgentRoleId;

export type HobitAgentStatus =
  | "idle"
  | "running"
  | "waiting"
  | "blocked"
  | "failed"
  | "stopped";

export type HobitAgentInstance = {
  agentId: HobitAgentId;
  capabilityManifest: HobitAgentCapabilityRegistry;
  createdAt: string;
  role: HobitAgentRole;
  status: HobitAgentStatus;
  title: string;
  updatedAt: string;
};

export type HobitAgentRuntimeEvent = {
  agentId?: HobitAgentId;
  createdAt: string;
  eventId: string;
  kind:
    | "agent_registered"
    | "agent_unregistered"
    | "agent_status_updated"
    | "runtime_error";
  message: string;
  status?: HobitAgentStatus;
};

export type HobitAgentRuntimeError = {
  agentId?: HobitAgentId;
  code: "duplicate_agent_id" | "agent_not_found" | "blocked";
  message: string;
};

export type HobitAgentRuntimeState = {
  agents: HobitAgentInstance[];
  events: HobitAgentRuntimeEvent[];
  histories: HobitAgentHistory[];
  maxHistoryEvents: number;
  workspaceId: string;
};

export type HobitAgentRuntimeSnapshot = {
  agentCount: number;
  agents: HobitAgentInstance[];
  events: HobitAgentRuntimeEvent[];
  histories: HobitAgentHistory[];
  maxHistoryEvents: number;
  workspaceId: string;
};

export type HobitAgentLookupResult =
  | {
      agent: HobitAgentInstance;
      ok: true;
      status: "found";
    }
  | {
      error: HobitAgentRuntimeError;
      ok: false;
      status: "not_found";
    };

export const HOBIT_TEST_AGENT_CAPABILITIES: HobitAgentCapability[] = [
  testAgentCapability({
    description:
      "Read another registered in-app agent status from the pure runtime snapshot.",
    id: "agent.status.read",
    inputSchemaDescription: "Target agent id.",
    outputSchemaDescription: "Target agent id and current runtime status.",
    sideEffectLevel: "read",
    title: "Read Agent Status",
  }),
  testAgentCapability({
    description:
      "Read bounded in-app agent history from the pure runtime model.",
    id: "agent.history.read",
    inputSchemaDescription:
      "Target agent id plus optional history limit, direction, kind, and thread id.",
    outputSchemaDescription:
      "Bounded audited history result with truncation metadata.",
    sideEffectLevel: "read",
    title: "Read Agent History",
  }),
  testAgentCapability({
    description:
      "Send a typed internal message to another registered in-app agent.",
    id: "agent.message.send",
    inputSchemaDescription:
      "Sender agent id, receiver agent id, message body, timestamp, kind, and optional thread or correlation id.",
    outputSchemaDescription:
      "Structured typed message result and sender/receiver history updates.",
    sideEffectLevel: "write",
    title: "Send Agent Message",
  }),
  testAgentCapability({
    description:
      "Read another registered in-app agent capability manifest.",
    id: "agent.capabilities.read",
    inputSchemaDescription: "Target agent id.",
    outputSchemaDescription:
      "Capability manifest with typed capability metadata and policy fields.",
    sideEffectLevel: "read",
    title: "Read Agent Capabilities",
  }),
  testAgentCapability({
    description:
      "Run safe model-level self-test checks without shell, Codex, app API mutation, or broker execution.",
    id: "agent.selfTest.run",
    inputSchemaDescription: "Selected model self-test ids and dry-run flag.",
    outputSchemaDescription:
      "Safe dry-run self-test result with structured evidence.",
    sideEffectLevel: "read",
    title: "Run Agent Self-Test",
  }),
];

const HOBIT_TEST_AGENT_CAPABILITY_MANIFEST: HobitAgentCapabilityRegistry = {
  capabilities: [...HOBIT_TEST_AGENT_CAPABILITIES].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
  version: "hobit-agent-capability-runtime.v0",
};

export const HOBIT_TEST_AGENT_A: HobitAgentInstance = createTestAgent({
  agentId: "test.agentA",
  title: "Test Agent A",
});

export const HOBIT_TEST_AGENT_B: HobitAgentInstance = createTestAgent({
  agentId: "test.agentB",
  title: "Test Agent B",
});

export function createAgentRuntimeState({
  agents = [],
  histories = [],
  maxHistoryEvents = 50,
  workspaceId,
}: {
  agents?: readonly HobitAgentInstance[];
  histories?: readonly HobitAgentHistory[];
  maxHistoryEvents?: number;
  workspaceId: string;
}): HobitAgentRuntimeState {
  const boundedMaxHistoryEvents = normalizeLimit(maxHistoryEvents, 50);

  return {
    agents: cloneAgents(agents).sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    ),
    events: [],
    histories: histories.map((history) =>
      createAgentHistory({
        agentId: history.agentId,
        events: history.events,
        maxEvents: boundedMaxHistoryEvents,
      }),
    ),
    maxHistoryEvents: boundedMaxHistoryEvents,
    workspaceId,
  };
}

export function registerAgent(
  state: HobitAgentRuntimeState,
  agent: HobitAgentInstance,
): { agent: HobitAgentInstance; state: HobitAgentRuntimeState; ok: true } | {
  error: HobitAgentRuntimeError;
  state: HobitAgentRuntimeState;
  ok: false;
} {
  if (state.agents.some((candidate) => candidate.agentId === agent.agentId)) {
    const error: HobitAgentRuntimeError = {
      agentId: agent.agentId,
      code: "duplicate_agent_id",
      message: `Agent ${agent.agentId} is already registered.`,
    };

    return {
      error,
      ok: false,
      state: appendRuntimeEvent(state, {
        agentId: agent.agentId,
        kind: "runtime_error",
        message: error.message,
      }),
    };
  }

  const nextAgent = cloneAgent(agent);
  const stateWithAgent: HobitAgentRuntimeState = {
    ...state,
    agents: [...state.agents, nextAgent].sort((left, right) =>
      left.agentId.localeCompare(right.agentId),
    ),
    histories: ensureHistory(
      state.histories,
      nextAgent.agentId,
      state.maxHistoryEvents,
    ),
  };

  return {
    agent: nextAgent,
    ok: true,
    state: appendRuntimeEvent(stateWithAgent, {
      agentId: nextAgent.agentId,
      kind: "agent_registered",
      message: `Agent ${nextAgent.agentId} registered.`,
      status: nextAgent.status,
    }),
  };
}

export function unregisterAgent(
  state: HobitAgentRuntimeState,
  agentId: HobitAgentId,
): { agent: HobitAgentInstance; state: HobitAgentRuntimeState; ok: true } | {
  error: HobitAgentRuntimeError;
  state: HobitAgentRuntimeState;
  ok: false;
} {
  const lookup = findAgent(state, agentId);
  if (!lookup.ok) {
    return {
      error: lookup.error,
      ok: false,
      state: appendRuntimeEvent(state, {
        agentId,
        kind: "runtime_error",
        message: lookup.error.message,
      }),
    };
  }

  const nextState: HobitAgentRuntimeState = {
    ...state,
    agents: state.agents.filter((agent) => agent.agentId !== agentId),
    histories: state.histories.filter((history) => history.agentId !== agentId),
  };

  return {
    agent: lookup.agent,
    ok: true,
    state: appendRuntimeEvent(nextState, {
      agentId,
      kind: "agent_unregistered",
      message: `Agent ${agentId} unregistered.`,
    }),
  };
}

export function listAgents(
  state: HobitAgentRuntimeState,
): HobitAgentInstance[] {
  return cloneAgents(state.agents);
}

export function findAgent(
  state: HobitAgentRuntimeState,
  agentId: HobitAgentId,
): HobitAgentLookupResult {
  const agent = state.agents.find((candidate) => candidate.agentId === agentId);
  if (!agent) {
    return {
      error: {
        agentId,
        code: "agent_not_found",
        message: `Agent ${agentId} is not registered.`,
      },
      ok: false,
      status: "not_found",
    };
  }

  return {
    agent: cloneAgent(agent),
    ok: true,
    status: "found",
  };
}

export function getAgentStatus(
  state: HobitAgentRuntimeState,
  agentId: HobitAgentId,
):
  | { agentId: HobitAgentId; ok: true; status: HobitAgentStatus }
  | { error: HobitAgentRuntimeError; ok: false; status: "not_found" } {
  const lookup = findAgent(state, agentId);
  if (!lookup.ok) {
    return {
      error: lookup.error,
      ok: false,
      status: "not_found",
    };
  }

  return {
    agentId,
    ok: true,
    status: lookup.agent.status,
  };
}

export function updateAgentStatus(
  state: HobitAgentRuntimeState,
  {
    agentId,
    status,
    updatedAt,
  }: {
    agentId: HobitAgentId;
    status: HobitAgentStatus;
    updatedAt: string;
  },
):
  | { agent: HobitAgentInstance; state: HobitAgentRuntimeState; ok: true }
  | { error: HobitAgentRuntimeError; state: HobitAgentRuntimeState; ok: false } {
  const lookup = findAgent(state, agentId);
  if (!lookup.ok) {
    return {
      error: lookup.error,
      ok: false,
      state: appendRuntimeEvent(state, {
        agentId,
        kind: "runtime_error",
        message: lookup.error.message,
      }),
    };
  }

  const updatedAgent = {
    ...lookup.agent,
    status,
    updatedAt,
  };
  const nextState: HobitAgentRuntimeState = {
    ...state,
    agents: state.agents.map((agent) =>
      agent.agentId === agentId ? updatedAgent : agent,
    ),
  };

  return {
    agent: updatedAgent,
    ok: true,
    state: appendRuntimeEvent(nextState, {
      agentId,
      kind: "agent_status_updated",
      message: `Agent ${agentId} status updated to ${status}.`,
      status,
    }),
  };
}

export function getAgentRuntimeSnapshot(
  state: HobitAgentRuntimeState,
): HobitAgentRuntimeSnapshot {
  return {
    agentCount: state.agents.length,
    agents: cloneAgents(state.agents),
    events: state.events.map((event) => ({ ...event })),
    histories: state.histories.map((history) =>
      createAgentHistory({
        agentId: history.agentId,
        events: history.events,
        maxEvents: history.maxEvents,
      }),
    ),
    maxHistoryEvents: state.maxHistoryEvents,
    workspaceId: state.workspaceId,
  };
}

export function getAgentCapabilityManifest(
  state: HobitAgentRuntimeState,
  agentId: HobitAgentId,
):
  | {
      agentId: HobitAgentId;
      capabilityManifest: HobitAgentCapabilityRegistry;
      ok: true;
      status: "found";
    }
  | { error: HobitAgentRuntimeError; ok: false; status: "not_found" } {
  const lookup = findAgent(state, agentId);
  if (!lookup.ok) {
    return {
      error: lookup.error,
      ok: false,
      status: "not_found",
    };
  }

  return {
    agentId,
    capabilityManifest: cloneCapabilityRegistry(
      lookup.agent.capabilityManifest,
    ),
    ok: true,
    status: "found",
  };
}

export function getAgentBoundedHistory(
  state: HobitAgentRuntimeState,
  query: HobitAgentHistoryQuery,
):
  | { history: HobitAgentHistoryResult; ok: true; status: "found" }
  | { error: HobitAgentRuntimeError; ok: false; status: "not_found" } {
  const lookup = findAgent(state, query.agentId);
  if (!lookup.ok) {
    return {
      error: lookup.error,
      ok: false,
      status: "not_found",
    };
  }

  const history =
    state.histories.find((candidate) => candidate.agentId === query.agentId) ??
    createAgentHistory({
      agentId: query.agentId,
      maxEvents: state.maxHistoryEvents,
    });

  return {
    history: getBoundedAgentHistory(history, query),
    ok: true,
    status: "found",
  };
}

function appendRuntimeEvent(
  state: HobitAgentRuntimeState,
  event: Omit<HobitAgentRuntimeEvent, "createdAt" | "eventId">,
): HobitAgentRuntimeState {
  const createdAt =
    state.events.length > 0
      ? state.events[state.events.length - 1]?.createdAt
      : "2026-01-01T00:00:00.000Z";
  const nextEvent = {
    ...event,
    createdAt,
    eventId: `${event.kind}:${event.agentId ?? "runtime"}:${state.events.length + 1}`,
  };

  return {
    ...state,
    events: [...state.events, nextEvent],
  };
}

function createTestAgent({
  agentId,
  title,
}: {
  agentId: HobitAgentId;
  title: string;
}): HobitAgentInstance {
  return {
    agentId,
    capabilityManifest: cloneCapabilityRegistry(
      HOBIT_TEST_AGENT_CAPABILITY_MANIFEST,
    ),
    createdAt: "2026-01-01T00:00:00.000Z",
    role: "test_harness",
    status: "idle",
    title,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function testAgentCapability({
  description,
  id,
  inputSchemaDescription,
  outputSchemaDescription,
  sideEffectLevel,
  title,
}: {
  description: string;
  id: string;
  inputSchemaDescription: string;
  outputSchemaDescription: string;
  sideEffectLevel: HobitAgentCapability["sideEffectLevel"];
  title: string;
}): HobitAgentCapability {
  return {
    allowedAgentRoles: ["test_harness"],
    auditEventNames: [`hobit.agent.runtime.${id}.requested`],
    availability: { status: "available" },
    confirmationRequirement: sideEffectLevel === "read" ? "none" : "recommended",
    defaultForProductActions: false,
    description,
    forbiddenSideEffects: [
      "app_control_action",
      "broker_execution",
      "codex_run",
      "destructive_action",
      "git_mutation",
      "regex_product_action_routing",
      "shell_command",
      "terminal_launch",
    ],
    id,
    inputSchemaDescription,
    outputSchemaDescription,
    ownerSurface: "Multi-Agent Runtime",
    restricted: false,
    sideEffectLevel,
    supportsDryRun: true,
    supportsSelfTest: true,
    title,
  };
}

function ensureHistory(
  histories: readonly HobitAgentHistory[],
  agentId: HobitAgentId,
  maxEvents: number,
) {
  if (histories.some((history) => history.agentId === agentId)) {
    return histories.map((history) =>
      createAgentHistory({
        agentId: history.agentId,
        events: history.events,
        maxEvents,
      }),
    );
  }

  return [
    ...histories,
    createAgentHistory({
      agentId,
      maxEvents,
    }),
  ].sort((left, right) => left.agentId.localeCompare(right.agentId));
}

function cloneAgent(agent: HobitAgentInstance): HobitAgentInstance {
  return {
    ...agent,
    capabilityManifest: cloneCapabilityRegistry(agent.capabilityManifest),
  };
}

function cloneAgents(
  agents: readonly HobitAgentInstance[],
): HobitAgentInstance[] {
  return agents.map(cloneAgent);
}

function cloneCapabilityRegistry(
  registry: HobitAgentCapabilityRegistry,
): HobitAgentCapabilityRegistry {
  return {
    capabilities: registry.capabilities.map((capability) => ({
      ...capability,
      allowedAgentRoles: [...capability.allowedAgentRoles],
      auditEventNames: [...capability.auditEventNames],
      forbiddenSideEffects: [...capability.forbiddenSideEffects],
    })),
    version: registry.version,
  };
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}
