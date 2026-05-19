export type CoordinatorProposalTypeId =
  | "create-agent-queue-task"
  | "create-note"
  | "prepare-jdbc-query-suggestion";

export type CoordinatorProposalApprovalStatus =
  | "Pending preview"
  | "Approved preview"
  | "Rejected preview"
  | "Edited preview";

export type CoordinatorProposalExecutionStatus =
  | "Not run"
  | "Ready to create Queue task"
  | "Creating Queue task"
  | "Queue task created"
  | "Queue task creation failed"
  | "Ready to create Note"
  | "Creating Note"
  | "Note created"
  | "Note creation failed"
  | "Execution bridge not implemented";

export type CoordinatorProposalInput = {
  label: string;
  value: string;
};

export type CoordinatorActionProposal = {
  approvalStatus: CoordinatorProposalApprovalStatus;
  createdNoteId?: string;
  createdNoteTitle?: string;
  createdQueueTaskId?: string;
  createdQueueTaskTitle?: string;
  executionError?: string;
  executionStatus: CoordinatorProposalExecutionStatus;
  expectedResult: string;
  id: string;
  inputs: CoordinatorProposalInput[];
  intent: string;
  resultSummary: string;
  riskLevel: "analysis_only" | "local_write";
  riskNotes: string[];
  targetCapability: string;
  targetWidget: string;
  title: string;
  typeId: CoordinatorProposalTypeId;
};

export type CoordinatorProposalTypeDefinition = {
  displayName: string;
  requiredInputs: string[];
  riskLevel: CoordinatorActionProposal["riskLevel"];
  safetyNotes: string[];
  targetCapability: string;
  targetWidget: string;
  typeId: CoordinatorProposalTypeId;
};

export const COORDINATOR_ACTION_PROPOSAL_REGISTRY: CoordinatorProposalTypeDefinition[] =
  [
    {
      displayName: "Create Agent Queue task",
      requiredInputs: ["Title", "Description", "Prompt"],
      riskLevel: "local_write",
      safetyNotes: [
        "Approved proposals may create a draft Queue task only after a separate create action.",
        "Creating the task must not start execution.",
        "No Queue auto-dispatch.",
      ],
      targetCapability: "create Queue task",
      targetWidget: "Agent Queue",
      typeId: "create-agent-queue-task",
    },
    {
      displayName: "Create Note",
      requiredInputs: ["Title", "Body"],
      riskLevel: "local_write",
      safetyNotes: [
        "Approved proposals may create a Note only after a separate create action.",
        "Creating the Note writes only the visible approved fields.",
        "No hidden Notes reading.",
      ],
      targetCapability: "create Note",
      targetWidget: "Notes",
      typeId: "create-note",
    },
    {
      displayName: "Prepare JDBC query suggestion",
      requiredInputs: ["Question", "Suggested SQL text"],
      riskLevel: "analysis_only",
      safetyNotes: [
        "Preview only in this UI slice.",
        "No connector access or SQL execution.",
        "No database metadata or results are inspected.",
      ],
      targetCapability: "prepare query suggestion",
      targetWidget: "Database / JDBC",
      typeId: "prepare-jdbc-query-suggestion",
    },
  ];

export const LOCAL_COORDINATOR_SAMPLE_PROPOSALS: CoordinatorActionProposal[] = [
  {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A reviewed draft Queue task can be created after approval, but it will not run automatically.",
    id: "sample-create-queue-task",
    inputs: [
      { label: "Title", value: "Investigate slow dashboard load" },
      {
        label: "Description",
        value: "Capture the operator request as a future engineering task.",
      },
      {
        label: "Prompt",
        value:
          "Review visible symptoms and propose next diagnostic steps. Do not run commands automatically.",
      },
    ],
    intent: "Turn the conversation into a queued follow-up task for later review.",
    resultSummary:
      "No action has run. Approval is required before Queue task creation is available.",
    riskLevel: "local_write",
    riskNotes: [
      "Queue task creation requires approval plus a separate Create Queue task action.",
      "No Agent Executor run is launched.",
      "No automatic dispatch is allowed.",
    ],
    targetCapability: "create Queue task",
    targetWidget: "Agent Queue",
    title: "Investigate slow dashboard load",
    typeId: "create-agent-queue-task",
  },
  {
    approvalStatus: "Pending preview",
    executionStatus: "Not run",
    expectedResult:
      "A reviewed workspace-local Note can be created after approval, but it will not trigger any other action.",
    id: "sample-create-note",
    inputs: [
      { label: "Title", value: "Coordinator summary draft" },
      {
        label: "Body",
        value:
          "Local proposal cards can show approved text before any future Notes handoff.",
      },
      { label: "Pinned", value: "false" },
    ],
    intent: "Save an operator-approved summary as a future note.",
    resultSummary:
      "No action has run. Approval is required before Note creation is available.",
    riskLevel: "local_write",
    riskNotes: [
      "Note creation requires approval plus a separate Create Note action.",
      "No existing Notes content is read.",
      "No provider receives note content.",
    ],
    targetCapability: "create Note",
    targetWidget: "Notes",
    title: "Coordinator summary draft",
    typeId: "create-note",
  },
  {
    approvalStatus: "Pending preview",
    executionStatus: "Execution bridge not implemented",
    expectedResult:
      "A SQL suggestion could be reviewed later, but this preview cannot execute SQL.",
    id: "sample-jdbc-query-suggestion",
    inputs: [
      {
        label: "Question",
        value: "Which query would help inspect recent error volume?",
      },
      {
        label: "Suggested SQL text",
        value:
          "select event_date, count(*) from app_errors group by event_date order by event_date desc",
      },
    ],
    intent: "Prepare a read-only query suggestion for operator review.",
    resultSummary: "No action has run. This is a local inert preview.",
    riskLevel: "analysis_only",
    riskNotes: [
      "No JDBC connector is accessed.",
      "No SQL is executed.",
      "No database metadata or results are read.",
    ],
    targetCapability: "prepare query suggestion",
    targetWidget: "Database / JDBC",
    title: "Preview: prepare JDBC query suggestion",
    typeId: "prepare-jdbc-query-suggestion",
  },
];
