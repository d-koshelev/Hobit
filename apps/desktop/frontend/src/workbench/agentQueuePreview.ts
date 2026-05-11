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

export type AgentQueuePreviewItem = {
  block: string;
  decision: AgentQueueDecisionHint;
  git: string;
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
  detailPreview: AgentQueueItemDetailPreview;
  groups: AgentQueueGroup[];
  linkedSurfaces: AgentQueueLinkedSurface[];
  overview: AgentQueueOverview;
  summary: AgentQueueSummary;
};

export const agentQueuePreview = {
  summary: {
    title: "Agent Queue",
    text:
      "Static review-board preview for future agent blocks. It shows what needs review, what is running, what failed, and what was accepted. Queue storage, execution, response capture, validation, Git association, and automatic acceptance are not implemented.",
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
  detailPreview: {
    ariaLabel: "Static Agent Queue item detail preview",
    block: "Block 72",
    title: "Git read-only polish",
    description:
      "Representative static review detail. No item selection, persistence, response capture, validation, Git association, or working actions exist.",
    badges: ["Static", "Planned"],
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
      actions: [
        { label: "Open request planned" },
        { label: "Open run planned" },
        { label: "Review Git planned" },
        { label: "Accept planned" },
        { label: "Needs fix planned" },
        { label: "Rerun planned" },
        { label: "Create follow-up planned" },
        { label: "Archive planned" },
      ],
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
} satisfies AgentQueuePreview;
