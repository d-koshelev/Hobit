import type { WorkspaceApi } from "./workspaceApiTypes";

export const deleteWorkspace: WorkspaceApi["deleteWorkspace"] = async (
  _request,
) => {
  throw new Error(
    "Workspace deletion is only available in the Tauri desktop shell. Browser fallback cannot delete persisted workspaces.",
  );
};

export const createWorkspaceNote: WorkspaceApi["createWorkspaceNote"] = async (
  _request,
) => {
  throw new Error(
    "Workspace Notes persistence is only available in the Tauri desktop shell. Browser fallback cannot persist workspace notes.",
  );
};

export const listWorkspaceNotes: WorkspaceApi["listWorkspaceNotes"] = async (
  _request,
) => {
  throw new Error(
    "Workspace Notes persistence is only available in the Tauri desktop shell. Browser fallback cannot read workspace notes.",
  );
};

export const getWorkspaceNote: WorkspaceApi["getWorkspaceNote"] = async (
  _request,
) => {
  throw new Error(
    "Workspace Notes persistence is only available in the Tauri desktop shell. Browser fallback cannot read workspace notes.",
  );
};

export const updateWorkspaceNote: WorkspaceApi["updateWorkspaceNote"] = async (
  _request,
) => {
  throw new Error(
    "Workspace Notes persistence is only available in the Tauri desktop shell. Browser fallback cannot update workspace notes.",
  );
};

export const createSkill: WorkspaceApi["createSkill"] = async (_request) => {
  throw new Error(
    "Skill Library persistence is only available in the Tauri desktop shell. Browser fallback cannot persist skills.",
  );
};

export const listSkills: WorkspaceApi["listSkills"] = async (_request) => {
  throw new Error(
    "Skill Library persistence is only available in the Tauri desktop shell. Browser fallback cannot read skills.",
  );
};

export const getSkill: WorkspaceApi["getSkill"] = async (_request) => {
  throw new Error(
    "Skill Library persistence is only available in the Tauri desktop shell. Browser fallback cannot read skills.",
  );
};

export const updateSkill: WorkspaceApi["updateSkill"] = async (_request) => {
  throw new Error(
    "Skill Library persistence is only available in the Tauri desktop shell. Browser fallback cannot update skills.",
  );
};

export const deleteSkill: WorkspaceApi["deleteSkill"] = async (_request) => {
  throw new Error(
    "Skill Library persistence is only available in the Tauri desktop shell. Browser fallback cannot delete skills.",
  );
};

export const createKnowledgeDocument: WorkspaceApi["createKnowledgeDocument"] =
  async (_request) => {
    throw new Error(
      "Knowledge Document persistence is only available in the Tauri desktop shell. Browser fallback cannot persist knowledge documents.",
    );
  };

export const listKnowledgeDocuments: WorkspaceApi["listKnowledgeDocuments"] =
  async (_request) => {
    throw new Error(
      "Knowledge Document persistence is only available in the Tauri desktop shell. Browser fallback cannot read knowledge documents.",
    );
  };

export const getKnowledgeDocument: WorkspaceApi["getKnowledgeDocument"] =
  async (_request) => {
    throw new Error(
      "Knowledge Document persistence is only available in the Tauri desktop shell. Browser fallback cannot read knowledge documents.",
    );
  };

export const updateKnowledgeDocument: WorkspaceApi["updateKnowledgeDocument"] =
  async (_request) => {
    throw new Error(
      "Knowledge Document persistence is only available in the Tauri desktop shell. Browser fallback cannot update knowledge documents.",
    );
  };

export const deleteKnowledgeDocument: WorkspaceApi["deleteKnowledgeDocument"] =
  async (_request) => {
    throw new Error(
      "Knowledge Document persistence is only available in the Tauri desktop shell. Browser fallback cannot delete knowledge documents.",
    );
  };

export const attachKnowledgeToQueueTask: WorkspaceApi["attachKnowledgeToQueueTask"] =
  async (_request) => {
    throw new Error(
      "Queue Knowledge context persistence is only available in the Tauri desktop shell. Browser fallback cannot attach Knowledge to Queue tasks.",
    );
  };

export const detachKnowledgeFromQueueTask: WorkspaceApi["detachKnowledgeFromQueueTask"] =
  async (_request) => {
    throw new Error(
      "Queue Knowledge context persistence is only available in the Tauri desktop shell. Browser fallback cannot detach Knowledge from Queue tasks.",
    );
  };

export const attachSkillToQueueTask: WorkspaceApi["attachSkillToQueueTask"] =
  async (_request) => {
    throw new Error(
      "Queue Skill context persistence is only available in the Tauri desktop shell. Browser fallback cannot attach Skills to Queue tasks.",
    );
  };

export const detachSkillFromQueueTask: WorkspaceApi["detachSkillFromQueueTask"] =
  async (_request) => {
    throw new Error(
      "Queue Skill context persistence is only available in the Tauri desktop shell. Browser fallback cannot detach Skills from Queue tasks.",
    );
  };

export const searchKnowledgeDocuments: WorkspaceApi["searchKnowledgeDocuments"] =
  async (_request) => {
    throw new Error(
      "Knowledge Document search is only available in the Tauri desktop shell. Browser fallback cannot search knowledge documents.",
    );
  };

export const recordKnowledgeDraftReview: WorkspaceApi["recordKnowledgeDraftReview"] =
  async (_request) => {
    throw new Error(
      "Knowledge draft review ledger persistence is only available in the Tauri desktop shell. Browser fallback cannot persist draft review decisions.",
    );
  };

export const listKnowledgeDraftReviews: WorkspaceApi["listKnowledgeDraftReviews"] =
  async (_request) => {
    throw new Error(
      "Knowledge draft review ledger persistence is only available in the Tauri desktop shell. Browser fallback cannot read draft review decisions.",
    );
  };

export const createJdbcConnector: WorkspaceApi["createJdbcConnector"] = async (
  _request,
) => {
  throw new Error(
    "JDBC connector metadata is only available in the Tauri desktop shell. Browser fallback cannot persist JDBC connectors.",
  );
};

export const listJdbcConnectors: WorkspaceApi["listJdbcConnectors"] = async (
  _request,
) => {
  throw new Error(
    "JDBC connector metadata is only available in the Tauri desktop shell. Browser fallback cannot read JDBC connectors.",
  );
};

export const getJdbcConnector: WorkspaceApi["getJdbcConnector"] = async (
  _request,
) => {
  throw new Error(
    "JDBC connector metadata is only available in the Tauri desktop shell. Browser fallback cannot read JDBC connectors.",
  );
};

export const updateJdbcConnector: WorkspaceApi["updateJdbcConnector"] = async (
  _request,
) => {
  throw new Error(
    "JDBC connector metadata is only available in the Tauri desktop shell. Browser fallback cannot update JDBC connectors.",
  );
};

export const validateJdbcReadOnlySql: WorkspaceApi["validateJdbcReadOnlySql"] =
  async (_request) => {
    throw new Error(
      "JDBC SQL validation is only available in the Tauri desktop shell. Browser fallback cannot validate JDBC SQL.",
    );
  };

export const executeJdbcReadOnlyQuery: WorkspaceApi["executeJdbcReadOnlyQuery"] =
  async (_request) => {
    throw new Error(
      "JDBC read-only query execution is only available in the Tauri desktop shell. Browser fallback cannot run JDBC queries.",
    );
  };

export const checkJdbcSidecarHealth: WorkspaceApi["checkJdbcSidecarHealth"] =
  async (_request) => {
    throw new Error(
      "JDBC sidecar diagnostics are only available in the Tauri desktop shell. Browser fallback cannot run local sidecar processes.",
    );
  };

export const probeJdbcDriver: WorkspaceApi["probeJdbcDriver"] =
  async (_request) => {
    throw new Error(
      "JDBC driver diagnostics are only available in the Tauri desktop shell. Browser fallback cannot load local JDBC drivers.",
    );
  };

export const createJdbcConnectionProfile: WorkspaceApi["createJdbcConnectionProfile"] =
  async (_request) => {
    throw new Error(
      "JDBC connection profiles are only available in the Tauri desktop shell. Browser fallback cannot persist JDBC profile metadata.",
    );
  };

export const listJdbcConnectionProfiles: WorkspaceApi["listJdbcConnectionProfiles"] =
  async (_request) => [];

export const getJdbcConnectionProfile: WorkspaceApi["getJdbcConnectionProfile"] =
  async (_request) => null;

export const updateJdbcConnectionProfile: WorkspaceApi["updateJdbcConnectionProfile"] =
  async (_request) => {
    throw new Error(
      "JDBC connection profiles are only available in the Tauri desktop shell. Browser fallback cannot update JDBC profile metadata.",
    );
  };

export const deleteJdbcConnectionProfile: WorkspaceApi["deleteJdbcConnectionProfile"] =
  async (_request) => {
    throw new Error(
      "JDBC connection profiles are only available in the Tauri desktop shell. Browser fallback cannot delete JDBC profile metadata.",
    );
  };

export const deleteWidgetInstanceFromWorkbench: WorkspaceApi["deleteWidgetInstanceFromWorkbench"] =
  async (_request) => {
    throw new Error(
      "Widget deletion is only available in the Tauri desktop shell. Browser fallback cannot delete persisted widget instances.",
    );
  };

export const listAgentExecutorRuns: WorkspaceApi["listAgentExecutorRuns"] =
  async (_request) => {
    throw new Error(
      "Agent Executor run history is only available in the Tauri desktop shell. Browser fallback cannot read persisted Direct Work artifacts.",
    );
  };

export const getAgentExecutorRunDetail: WorkspaceApi["getAgentExecutorRunDetail"] =
  async (_request) => {
    throw new Error(
      "Agent Executor run detail is only available in the Tauri desktop shell. Browser fallback cannot read persisted Direct Work artifacts.",
    );
  };

export const getAgentExecutorDiffSummary: WorkspaceApi["getAgentExecutorDiffSummary"] =
  async (_request) => {
    throw new Error(
      "Agent Executor diff summary is only available in the Tauri desktop shell. Browser fallback cannot read local Git diffs.",
    );
  };

export const getAgentMonitoringSnapshot: WorkspaceApi["getAgentMonitoringSnapshot"] =
  async (_request) => {
    throw new Error(
      "Agent Monitoring proposal result reads are only available in the Tauri desktop shell. Browser fallback has no persisted proposal run artifacts to display.",
    );
  };

export const createAgentQueueItemFromProposal: WorkspaceApi["createAgentQueueItemFromProposal"] =
  async (_request) => {
    throw new Error(
      "Agent Queue review item persistence is only available in the Tauri desktop shell. Browser fallback cannot create persisted queue items from proposal artifacts.",
    );
  };

export const getAgentQueueSnapshot: WorkspaceApi["getAgentQueueSnapshot"] =
  async (_request) => {
    throw new Error(
      "Agent Queue persisted review items are only available in the Tauri desktop shell. Browser fallback has no persisted queue inbox to display.",
    );
  };

export const createAgentQueueTask: WorkspaceApi["createAgentQueueTask"] =
  async (_request) => {
    throw new Error(
      "Agent Queue task persistence is only available in the Tauri desktop shell. Browser fallback cannot create persisted queue tasks.",
    );
  };

export const listAgentQueueTasks: WorkspaceApi["listAgentQueueTasks"] = async (
  _request,
) => {
  throw new Error(
    "Agent Queue task persistence is only available in the Tauri desktop shell. Browser fallback cannot read persisted queue tasks.",
  );
};

export const getAgentQueueTask: WorkspaceApi["getAgentQueueTask"] = async (
  _request,
) => {
  throw new Error(
    "Agent Queue task persistence is only available in the Tauri desktop shell. Browser fallback cannot read persisted queue tasks.",
  );
};

export const updateAgentQueueTask: WorkspaceApi["updateAgentQueueTask"] =
  async (_request) => {
    throw new Error(
      "Agent Queue task persistence is only available in the Tauri desktop shell. Browser fallback cannot update persisted queue tasks.",
    );
  };

export const deleteAgentQueueTask: WorkspaceApi["deleteAgentQueueTask"] =
  async (_request) => {
    throw new Error(
      "Agent Queue task persistence is only available in the Tauri desktop shell. Browser fallback cannot delete persisted queue tasks.",
    );
  };

export const listAgentQueueWorkers: WorkspaceApi["listAgentQueueWorkers"] =
  async (_request) => [];

export const createAgentQueueWorker: WorkspaceApi["createAgentQueueWorker"] =
  async (_request) => {
    throw new Error(
      "Agent Worker configuration persistence is only available in the Tauri desktop shell. Browser fallback cannot persist worker configuration.",
    );
  };

export const updateAgentQueueWorker: WorkspaceApi["updateAgentQueueWorker"] =
  async (_request) => {
    throw new Error(
      "Agent Worker configuration persistence is only available in the Tauri desktop shell. Browser fallback cannot update worker configuration.",
    );
  };

export const deleteAgentQueueWorker: WorkspaceApi["deleteAgentQueueWorker"] =
  async (_request) => {
    throw new Error(
      "Agent Worker configuration persistence is only available in the Tauri desktop shell. Browser fallback cannot delete worker configuration.",
    );
  };

export const assignAgentQueueTaskToExecutor: WorkspaceApi["assignAgentQueueTaskToExecutor"] =
  async (_request) => {
    throw new Error(
      "Agent Queue assignment persistence is only available in the Tauri desktop shell. Browser fallback cannot assign queue tasks to executor slots.",
    );
  };

export const clearAgentQueueTaskAssignment: WorkspaceApi["clearAgentQueueTaskAssignment"] =
  async (_request) => {
    throw new Error(
      "Agent Queue assignment persistence is only available in the Tauri desktop shell. Browser fallback cannot clear queue task assignments.",
    );
  };

export const startAssignedAgentQueueTask: WorkspaceApi["startAssignedAgentQueueTask"] =
  async (_request) => {
    throw new Error(
      "Agent Queue execution is only available in the Tauri desktop shell. Browser fallback cannot start assigned queue tasks.",
    );
  };

export const getAgentQueueTaskLatestRunLink: WorkspaceApi["getAgentQueueTaskLatestRunLink"] =
  async (_request) => null;

export const listAgentQueueTaskRunLinks: WorkspaceApi["listAgentQueueTaskRunLinks"] =
  async (_request) => [];

export const startAgentQueueRunnerSession: WorkspaceApi["startAgentQueueRunnerSession"] =
  async (_request) => {
    throw new Error(
      "Queue Autorun session control is only available in the Tauri desktop shell. Browser fallback cannot arm Queue Autorun.",
    );
  };

export const stopAgentQueueRunnerSession: WorkspaceApi["stopAgentQueueRunnerSession"] =
  async () => {
    throw new Error(
      "Queue Autorun session control is only available in the Tauri desktop shell. Browser fallback cannot stop Queue Autorun.",
    );
  };

export const getAgentQueueRunnerSnapshot: WorkspaceApi["getAgentQueueRunnerSnapshot"] =
  async () => {
    throw new Error(
      "Queue Autorun session status is only available in the Tauri desktop shell. Browser fallback cannot inspect Queue Autorun.",
    );
  };

export const getGitRepositoryStatus: WorkspaceApi["getGitRepositoryStatus"] =
  async (_request) => {
    throw new Error(
      "Git status is only available in the Tauri desktop shell. Browser fallback cannot read Git repositories.",
    );
  };

export const getGitFileDiff: WorkspaceApi["getGitFileDiff"] = async (
  _request,
) => {
  throw new Error(
    "Git file diff is only available in the Tauri desktop shell. Browser fallback cannot read local Git diffs.",
  );
};

export const getGitLog: WorkspaceApi["getGitLog"] = async (_request) => {
  throw new Error(
    "Git history is only available in the Tauri desktop shell. Browser fallback cannot read local Git history.",
  );
};

export const createGitCommit: WorkspaceApi["createGitCommit"] = async (
  _request,
) => {
  throw new Error(
    "Git commit creation is only available in the Tauri desktop shell. Browser fallback cannot mutate Git repositories.",
  );
};

export const getWorkspaceGitStatus: WorkspaceApi["getWorkspaceGitStatus"] =
  async (_request) => {
    throw new Error(
      "Workspace Git status is only available in the Tauri desktop shell. Browser fallback cannot read Git repositories.",
    );
  };

export const getWorkspaceGitDiffSummary: WorkspaceApi["getWorkspaceGitDiffSummary"] =
  async (_request) => {
    throw new Error(
      "Workspace Git diff summary is only available in the Tauri desktop shell. Browser fallback cannot read local Git diffs.",
    );
  };

export const getWorkspaceGitFileDiff: WorkspaceApi["getWorkspaceGitFileDiff"] =
  async (_request) => {
    throw new Error(
      "Workspace Git file diff is only available in the Tauri desktop shell. Browser fallback cannot read local Git diffs.",
    );
  };

export const getWorkspaceGitLog: WorkspaceApi["getWorkspaceGitLog"] = async (
  _request,
) => {
  throw new Error(
    "Workspace Git history is only available in the Tauri desktop shell. Browser fallback cannot read local Git history.",
  );
};

export const createWorkspaceGitCommit: WorkspaceApi["createWorkspaceGitCommit"] =
  async (_request) => {
    throw new Error(
      "Workspace Git commit creation is only available in the Tauri desktop shell. Browser fallback cannot mutate Git repositories.",
    );
  };

export const pushWorkspaceGit: WorkspaceApi["pushWorkspaceGit"] = async (
  _request,
) => {
  throw new Error(
    "Workspace Git push is only available in the Tauri desktop shell. Browser fallback cannot mutate Git repositories.",
  );
};

export const runTerminalCommand: WorkspaceApi["runTerminalCommand"] = async (
  _request,
) => {
  throw new Error(
    "Terminal command execution is only available in the Tauri desktop shell. Browser fallback cannot run local processes.",
  );
};

export const createTerminalPtySession: WorkspaceApi["createTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot create local shell sessions.",
    );
  };

export const writeTerminalPtySession: WorkspaceApi["writeTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot send stdin to local shell sessions.",
    );
  };

export const resizeTerminalPtySession: WorkspaceApi["resizeTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot resize local shell sessions.",
    );
  };

export const stopTerminalPtySession: WorkspaceApi["stopTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot stop local shell sessions.",
    );
  };

export const killTerminalPtySession: WorkspaceApi["killTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot force terminate local shell sessions.",
    );
  };

export const closeTerminalPtySession: WorkspaceApi["closeTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot close local shell sessions.",
    );
  };

export const getTerminalPtySession: WorkspaceApi["getTerminalPtySession"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot inspect local shell sessions.",
    );
  };

export const listTerminalPtySessions: WorkspaceApi["listTerminalPtySessions"] =
  async (_request) => {
    throw new Error(
      "Terminal PTY sessions are only available in the Tauri desktop shell. Browser fallback cannot list local shell sessions.",
    );
  };

export const runCodexDirectWork: WorkspaceApi["runCodexDirectWork"] = async (
  _request,
) => {
  throw new Error(
    "Codex Direct Work is only available in the Tauri desktop shell. Browser fallback cannot run local executor processes or persist Direct Work artifacts.",
  );
};

export const runDirectWorkValidation: WorkspaceApi["runDirectWorkValidation"] =
  async (_request) => {
    throw new Error(
      "Direct Work validation capture is only available in the Tauri desktop shell. Browser fallback cannot run Toolbelt validation or persist Direct Work validation artifacts.",
    );
  };

export const cancelCodexDirectWorkRun: WorkspaceApi["cancelCodexDirectWorkRun"] =
  async (_request) => {
    throw new Error(
      "Codex Direct Work cancellation is only available in the Tauri desktop shell. Browser fallback cannot stop local executor processes.",
    );
  };

export const forceKillCodexDirectWorkRun: WorkspaceApi["forceKillCodexDirectWorkRun"] =
  async (_request) => {
    throw new Error(
      "Codex Direct Work force kill is only available in the Tauri desktop shell. Browser fallback cannot terminate local executor processes.",
    );
  };

export const startCodexDirectWorkStream: WorkspaceApi["startCodexDirectWorkStream"] =
  async (_request) => {
    throw new Error(
      "Codex Direct Work streaming is only available in the Tauri desktop shell. Browser fallback cannot run local executor processes or stream Direct Work events.",
    );
  };

export const listenToDirectWorkStreamEvents: WorkspaceApi["listenToDirectWorkStreamEvents"] =
  async (_onEvent) => {
    throw new Error(
      "Codex Direct Work streaming is only available in the Tauri desktop shell. Browser fallback cannot subscribe to Direct Work events.",
    );
  };

export const persistAgentChatProposal: WorkspaceApi["persistAgentChatProposal"] =
  async (_request) => {
    throw new Error(
      "Agent Chat proposal persistence is only available in the Tauri desktop shell. Browser fallback keeps the proposal preview local and does not persist run artifacts.",
    );
  };

export const generateAgentChatAiProposal: WorkspaceApi["generateAgentChatAiProposal"] =
  async (_request) => {
    throw new Error(
      "Agent Chat AI provider calls are only available through the Tauri desktop backend. Browser fallback does not call AI providers directly.",
    );
  };

export const generateCoordinatorProviderResponse: WorkspaceApi["generateCoordinatorProviderResponse"] =
  async (_request) => {
    throw new Error(
      "Workspace Agent mock provider responses are only available through the Tauri desktop backend. Browser fallback keeps Workspace Agent deterministic and local.",
    );
  };
