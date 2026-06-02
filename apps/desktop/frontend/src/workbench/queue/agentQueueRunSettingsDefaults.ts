import type {
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import { defaultCodexExecutable } from "./agentQueueControllerHelpers";

export type AgentQueueTaskRunSettingsDefaults = {
  approvalPolicy: DirectWorkApprovalPolicy;
  codexExecutable: string;
  executionWorkspace: string;
  sandbox: DirectWorkSandbox;
};

type AgentQueueRunSettingsSource = {
  approvalPolicy: DirectWorkApprovalPolicy | "";
  codexExecutableDraft: string;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox | "";
};

export function defaultAgentQueueTaskRunSettings(): AgentQueueTaskRunSettingsDefaults {
  return {
    approvalPolicy: "never",
    codexExecutable: defaultCodexExecutable(),
    executionWorkspace: "",
    sandbox: "danger_full_access",
  };
}

export function agentQueueTaskRunSettingsDefaultsFromRun(
  run: AgentQueueRunSettingsSource,
): AgentQueueTaskRunSettingsDefaults {
  return {
    approvalPolicy: normalizeApprovalPolicy(run.approvalPolicy),
    codexExecutable:
      run.codexExecutableDraft.trim() || defaultCodexExecutable(),
    executionWorkspace: run.repoRootDraft,
    sandbox: normalizeSandbox(run.sandbox),
  };
}

function normalizeSandbox(value: DirectWorkSandbox | ""): DirectWorkSandbox {
  return value === "read_only" ||
    value === "workspace_write" ||
    value === "danger_full_access"
    ? value
    : "danger_full_access";
}

function normalizeApprovalPolicy(
  value: DirectWorkApprovalPolicy | "",
): DirectWorkApprovalPolicy {
  return value === "on_request" || value === "untrusted" ? value : "never";
}
