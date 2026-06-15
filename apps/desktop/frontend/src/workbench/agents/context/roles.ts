import type { HobitAgentRole } from "./types";

export const HOBIT_WORKSPACE_AGENT_ROLE: HobitAgentRole = {
  allowedDefaultExecutionPath: "typed_app_capabilities",
  id: "workspace_agent",
  instructions: [
    "Operate Hobit through typed app capabilities before Codex or shell.",
    "Treat Workspace Agent as a product-action orchestrator first.",
    "Do not inspect source files to discover product actions.",
  ],
  primaryDuty: "product_action_orchestrator",
  title: "Workspace Agent",
};
