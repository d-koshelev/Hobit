export const WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY = {
  id: "workspace-agent-v2-direct-run-smoke",
  label: "Workspace Agent v2",
  route: "/smoke/dev/workspace-agent-v2-direct-run-smoke.html",
  status: "Experimental",
  mode: "Codex Direct Run only",
} as const;

export function workspaceAgentV2ExperimentalAccessSummary() {
  return `${WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.label} - ${WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.status} - ${WORKSPACE_AGENT_V2_EXPERIMENTAL_ENTRY.mode}`;
}
