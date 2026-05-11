export type AgentQueueStatusVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error";

export type AgentQueueSummary = {
  badgeLabel: string;
  text: string;
  title: string;
};

export type AgentQueueOverviewMetric = {
  label: string;
  variant: AgentQueueStatusVariant;
  value: string;
};

export type AgentQueueOverview = {
  ariaLabel: string;
  metrics: AgentQueueOverviewMetric[];
  text: string;
  title: string;
};

export type AgentQueueItemStatus = {
  label: string;
  variant: AgentQueueStatusVariant;
};

export type AgentQueueDecisionHint = {
  label: string;
};

export type AgentQueuePreviewItemId = string;

export type AgentQueuePreviewItem = {
  block: string;
  decision: AgentQueueDecisionHint;
  git: string;
  id: AgentQueuePreviewItemId;
  status: AgentQueueItemStatus;
  title: string;
  validation: string;
};

export type AgentQueueGroup = {
  badgeLabel: string;
  badgeVariant: AgentQueueStatusVariant;
  description: string;
  items: AgentQueuePreviewItem[];
  title: string;
};

export type AgentQueueLinkedSurface = {
  label: string;
  value: string;
};

export type AgentQueuePlannedAction = {
  label: string;
};

export type AgentQueueDetailField = {
  label: string;
  value: string;
};

export type AgentQueueRequestPreview = {
  fields: AgentQueueDetailField[];
  title: string;
};

export type AgentQueueExecutionPreview = {
  fields: AgentQueueDetailField[];
  title: string;
};

export type AgentQueueResultPreview = {
  fields: AgentQueueDetailField[];
  title: string;
};

export type AgentQueueGitReviewPreview = {
  fields: AgentQueueDetailField[];
  title: string;
};

export type AgentQueueArtifactPreview = {
  fields: AgentQueueDetailField[];
  title: string;
};

export type AgentQueueDecisionPreview = {
  actions: AgentQueuePlannedAction[];
  fields: AgentQueueDetailField[];
  title: string;
};

export type AgentQueueItemDetailPreview = {
  ariaLabel: string;
  badges: string[];
  block: string;
  description: string;
  execution: AgentQueueExecutionPreview;
  gitReview: AgentQueueGitReviewPreview;
  artifacts: AgentQueueArtifactPreview;
  request: AgentQueueRequestPreview;
  result: AgentQueueResultPreview;
  decision: AgentQueueDecisionPreview;
  title: string;
};

export type AgentQueuePreview = {
  defaultSelectedItemId: AgentQueuePreviewItemId;
  detailPreviews: Record<AgentQueuePreviewItemId, AgentQueueItemDetailPreview>;
  groups: AgentQueueGroup[];
  linkedSurfaces: AgentQueueLinkedSurface[];
  overview: AgentQueueOverview;
  summary: AgentQueueSummary;
};

const plannedDecisionActions: AgentQueuePlannedAction[] = [
  { label: "Open request planned" },
  { label: "Open run planned" },
  { label: "Review Git planned" },
  { label: "Accept planned" },
  { label: "Needs fix planned" },
  { label: "Rerun planned" },
  { label: "Create follow-up planned" },
  { label: "Archive planned" },
];

export const agentQueuePreview: AgentQueuePreview = {
  summary: {
    title: "Agent Queue",
    text:
      "Static review-board preview for future agent blocks. Selecting a card only swaps local static detail copy. Queue storage, execution, response capture, validation, Git association, and automatic acceptance are not implemented.",
    badgeLabel: "Static",
  },
  overview: {
    ariaLabel: "Queue overview",
    title: "Review snapshot",
    text:
      "Future queue cards are review units: each one returns to an explicit operator decision before acceptance.",
    metrics: [
      { label: "Needs review", variant: "warning", value: "1" },
      { label: "Running / queued", variant: "info", value: "1" },
      { label: "Failed / blocked", variant: "error", value: "1" },
      { label: "Accepted", variant: "success", value: "1" },
    ],
  },
  groups: [
    {
      badgeLabel: "1",
      badgeVariant: "warning",
      description: "Completed work waiting for an operator decision.",
      title: "Needs review",
      items: [
        {
          block: "Block 72",
          decision: { label: "Review Git, then decide" },
          git: "3 changed files",
          id: "block-72-git-read-only-polish",
          status: {
            label: "Needs review",
            variant: "warning",
          },
          title: "Git read-only polish",
          validation: "Passed",
        },
      ],
    },
    {
      badgeLabel: "1",
      badgeVariant: "info",
      description: "Work in flight or queued for a future executor.",
      title: "Running / queued",
      items: [
        {
          block: "Block 73",
          decision: { label: "Watch run status" },
          git: "Not linked",
          id: "block-73-notebook-tabs-plan",
          status: {
            label: "Running",
            variant: "info",
          },
          title: "Notebook tabs plan",
          validation: "Not run",
        },
      ],
    },
    {
      badgeLabel: "1",
      badgeVariant: "error",
      description: "Failures or missing context that need correction.",
      title: "Failed / blocked",
      items: [
        {
          block: "Block 74",
          decision: { label: "Create fix block" },
          git: "Dirty state visible",
          id: "block-74-template-response-parser",
          status: {
            label: "Blocked",
            variant: "error",
          },
          title: "Template response parser",
          validation: "Failed",
        },
      ],
    },
    {
      badgeLabel: "1",
      badgeVariant: "success",
      description: "Accepted work remains explicit and auditable.",
      title: "Accepted / completed",
      items: [
        {
          block: "Block 70",
          decision: { label: "Review archived result" },
          git: "Clean after commit",
          id: "block-70-agent-queue-contract",
          status: {
            label: "Accepted",
            variant: "success",
          },
          title: "Agent Queue contract",
          validation: "Passed",
        },
      ],
    },
  ],
  defaultSelectedItemId: "block-72-git-read-only-polish",
  detailPreviews: {
    "block-72-git-read-only-polish": {
      ariaLabel: "Static Agent Queue item detail preview",
      block: "Block 72",
      title: "Git read-only polish",
      description:
        "Selected static review detail. This local selection is not persisted and no response capture, validation, Git association, or working actions exist.",
      badges: ["Static", "Needs review", "Planned actions"],
      request: {
        title: "Request",
        fields: [
          {
            label: "Request Template",
            value: "Codex implementation block",
          },
          {
            label: "Response Template",
            value: "Implementation result",
          },
          {
            label: "Prompt snapshot",
            value: "Summary planned; no request generation exists.",
          },
          {
            label: "Scope",
            value:
              "Read-only Git polish block with explicit do-not-change boundaries.",
          },
          {
            label: "Do not change",
            value:
              "No Git mutations, storage, queue execution, or runtime behavior.",
          },
        ],
      },
      execution: {
        title: "Execution",
        fields: [
          {
            label: "Agent Run status",
            value: "Result Report planned",
          },
          {
            label: "Overview Log",
            value: "Step summary planned for quick review.",
          },
          {
            label: "Raw Log",
            value: "Raw Log link planned; no run log storage exists.",
          },
        ],
      },
      result: {
        title: "Result",
        fields: [
          {
            label: "Result Report",
            value: "Implementation summary planned.",
          },
          {
            label: "Validation",
            value: "Passed placeholder; no response validator exists.",
          },
          {
            label: "Warnings",
            value: "None shown in this static preview.",
          },
          {
            label: "Commit",
            value: "Commit/status summary planned when linked data exists.",
          },
        ],
      },
      gitReview: {
        title: "Git Review",
        fields: [
          {
            label: "Repository state",
            value: "Dirty review state planned.",
          },
          {
            label: "Changed files",
            value: "3 changed files",
          },
          {
            label: "Branch / commit / push",
            value: "Branch, commit, and push summary planned.",
          },
          {
            label: "Action",
            value: "Review Git planned",
          },
        ],
      },
      artifacts: {
        title: "Artifacts / Notes",
        fields: [
          {
            label: "Artifacts",
            value: "Artifacts planned; no artifact storage exists.",
          },
          {
            label: "Notes / Notebook",
            value: "Review notes planned; notes are not linked here.",
          },
        ],
      },
      decision: {
        title: "Decision",
        fields: [
          {
            label: "Recommendation",
            value: "Review Git, then accept or request a fix.",
          },
          {
            label: "Operator control",
            value:
              "Operator decision remains explicit; no automatic acceptance exists.",
          },
        ],
        actions: plannedDecisionActions,
      },
    },
    "block-73-notebook-tabs-plan": {
      ariaLabel: "Static Agent Queue item detail preview",
      block: "Block 73",
      title: "Notebook tabs plan",
      description:
        "Selected static running/queued detail. It previews how a future queue item might be reviewed, but no executor or queue state exists.",
      badges: ["Static", "Running", "Planned actions"],
      request: {
        title: "Request",
        fields: [
          {
            label: "Request Template",
            value: "Codex planning block",
          },
          {
            label: "Response Template",
            value: "Plan result",
          },
          {
            label: "Prompt snapshot",
            value: "Notebook tabs direction planned; no request generation exists.",
          },
          {
            label: "Scope",
            value: "Plan the future Notebook tab model without implementation.",
          },
          {
            label: "Do not change",
            value:
              "No Notebook tabs, schema changes, runtime behavior, or AI editing.",
          },
        ],
      },
      execution: {
        title: "Execution",
        fields: [
          {
            label: "Agent Run status",
            value: "Running preview only; no executor is connected.",
          },
          {
            label: "Overview Log",
            value: "Future live step summary would appear here.",
          },
          {
            label: "Raw Log",
            value: "Raw Log link planned; no run log storage exists.",
          },
        ],
      },
      result: {
        title: "Result",
        fields: [
          {
            label: "Result Report",
            value: "No captured result exists in this static running preview.",
          },
          {
            label: "Validation",
            value: "Not run placeholder; no response validator exists.",
          },
          {
            label: "Warnings",
            value: "Execution state is illustrative only.",
          },
          {
            label: "Commit",
            value: "No commit linked.",
          },
        ],
      },
      gitReview: {
        title: "Git Review",
        fields: [
          {
            label: "Repository state",
            value: "Not linked.",
          },
          {
            label: "Changed files",
            value: "No changed-file summary in this preview.",
          },
          {
            label: "Branch / commit / push",
            value: "Git summary planned when linked data exists.",
          },
          {
            label: "Action",
            value: "Watch run status planned.",
          },
        ],
      },
      artifacts: {
        title: "Artifacts / Notes",
        fields: [
          {
            label: "Artifacts",
            value: "Planning notes would be listed when future storage exists.",
          },
          {
            label: "Notes / Notebook",
            value: "Notebook context planned; notes are not linked here.",
          },
        ],
      },
      decision: {
        title: "Decision",
        fields: [
          {
            label: "Recommendation",
            value: "Watch run status; no transition occurs in this placeholder.",
          },
          {
            label: "Operator control",
            value:
              "Operator decisions remain planned and disabled until queue behavior exists.",
          },
        ],
        actions: plannedDecisionActions,
      },
    },
    "block-74-template-response-parser": {
      ariaLabel: "Static Agent Queue item detail preview",
      block: "Block 74",
      title: "Template response parser",
      description:
        "Selected static failed/blocked detail. It highlights the future review shape without implementing response parsing or validation.",
      badges: ["Static", "Blocked", "Planned actions"],
      request: {
        title: "Request",
        fields: [
          {
            label: "Request Template",
            value: "Codex implementation block",
          },
          {
            label: "Response Template",
            value: "Implementation result",
          },
          {
            label: "Prompt snapshot",
            value: "Parser request planned; no request generation exists.",
          },
          {
            label: "Scope",
            value: "Prototype future response parser contract boundaries.",
          },
          {
            label: "Do not change",
            value:
              "No response parser, validator, storage, queue execution, or runtime behavior.",
          },
        ],
      },
      execution: {
        title: "Execution",
        fields: [
          {
            label: "Agent Run status",
            value: "Blocked preview only; no executor is connected.",
          },
          {
            label: "Overview Log",
            value: "Future blocked reason summary would appear here.",
          },
          {
            label: "Raw Log",
            value: "Raw Log link planned; no run log storage exists.",
          },
        ],
      },
      result: {
        title: "Result",
        fields: [
          {
            label: "Result Report",
            value: "Failed placeholder; no captured response exists.",
          },
          {
            label: "Validation",
            value: "Failed placeholder; no response validator exists.",
          },
          {
            label: "Warnings",
            value: "Missing context is shown as static preview data.",
          },
          {
            label: "Commit",
            value: "No commit linked.",
          },
        ],
      },
      gitReview: {
        title: "Git Review",
        fields: [
          {
            label: "Repository state",
            value: "Dirty state visible planned.",
          },
          {
            label: "Changed files",
            value: "Changed-file review planned; no Git association exists.",
          },
          {
            label: "Branch / commit / push",
            value: "No commit or push state linked.",
          },
          {
            label: "Action",
            value: "Create fix block planned.",
          },
        ],
      },
      artifacts: {
        title: "Artifacts / Notes",
        fields: [
          {
            label: "Artifacts",
            value: "Failure artifacts planned; no artifact storage exists.",
          },
          {
            label: "Notes / Notebook",
            value: "Fix rationale planned; notes are not linked here.",
          },
        ],
      },
      decision: {
        title: "Decision",
        fields: [
          {
            label: "Recommendation",
            value: "Create a fix block after reviewing the failed state.",
          },
          {
            label: "Operator control",
            value:
              "No fix block is created here; all planned actions remain disabled.",
          },
        ],
        actions: plannedDecisionActions,
      },
    },
    "block-70-agent-queue-contract": {
      ariaLabel: "Static Agent Queue item detail preview",
      block: "Block 70",
      title: "Agent Queue contract",
      description:
        "Selected static accepted/completed detail. Acceptance is displayed as preview data only and is not a real queue decision.",
      badges: ["Static", "Accepted", "Planned actions"],
      request: {
        title: "Request",
        fields: [
          {
            label: "Request Template",
            value: "Codex documentation block",
          },
          {
            label: "Response Template",
            value: "Documentation result",
          },
          {
            label: "Prompt snapshot",
            value: "Contract definition request planned; no request generation exists.",
          },
          {
            label: "Scope",
            value: "Define Agent Queue as an operator review inbox.",
          },
          {
            label: "Do not change",
            value:
              "No queue storage, execution, response capture, or Git mutation.",
          },
        ],
      },
      execution: {
        title: "Execution",
        fields: [
          {
            label: "Agent Run status",
            value: "Completed preview only; no run record exists.",
          },
          {
            label: "Overview Log",
            value: "Completion steps planned for future run observability.",
          },
          {
            label: "Raw Log",
            value: "Raw Log link planned; no run log storage exists.",
          },
        ],
      },
      result: {
        title: "Result",
        fields: [
          {
            label: "Result Report",
            value: "Contract summary planned as accepted static preview data.",
          },
          {
            label: "Validation",
            value: "Passed placeholder; no response validator exists.",
          },
          {
            label: "Warnings",
            value: "Accepted state is illustrative and not persisted.",
          },
          {
            label: "Commit",
            value: "Commit/status summary planned when linked data exists.",
          },
        ],
      },
      gitReview: {
        title: "Git Review",
        fields: [
          {
            label: "Repository state",
            value: "Clean after commit preview.",
          },
          {
            label: "Changed files",
            value: "No active changed files in this accepted preview.",
          },
          {
            label: "Branch / commit / push",
            value: "Historical commit and push summary planned.",
          },
          {
            label: "Action",
            value: "Review archived result planned.",
          },
        ],
      },
      artifacts: {
        title: "Artifacts / Notes",
        fields: [
          {
            label: "Artifacts",
            value: "Contract document link planned; no artifact storage exists.",
          },
          {
            label: "Notes / Notebook",
            value: "Decision rationale planned; notes are not linked here.",
          },
        ],
      },
      decision: {
        title: "Decision",
        fields: [
          {
            label: "Recommendation",
            value: "Review the archived result if more context is needed.",
          },
          {
            label: "Operator control",
            value:
              "Accepted state remains static preview data; no queue history is written.",
          },
        ],
        actions: plannedDecisionActions,
      },
    },
  },
  linkedSurfaces: [
    {
      label: "Template Library",
      value: "Provides Request and Response Template references.",
    },
    {
      label: "Agent Run",
      value: "Provides Overview Log, Result Report, and Raw Log views.",
    },
    {
      label: "Git Widget",
      value: "Provides repository state, changed files, and push reminders.",
    },
    {
      label: "Notes / Notebook",
      value: "Captures review notes, assumptions, and follow-up rationale.",
    },
    {
      label: "Workspace Activity",
      value: "Records queue lifecycle events when future storage exists.",
    },
  ],
};
