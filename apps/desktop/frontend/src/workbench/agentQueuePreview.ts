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
  requestTemplate: string;
  responseTemplate: string;
  run: string;
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
  plannedActions: AgentQueuePlannedAction[];
  summary: AgentQueueSummary;
};

export const agentQueuePreview = {
  summary: {
    title: "Agent Queue",
    text:
      "Static preview of a future operator-controlled queue and review inbox for agent blocks. Queue storage, automatic execution, response capture, validation, Git association, and automatic acceptance are not implemented.",
    badgeLabel: "Static preview",
  },
  overview: {
    ariaLabel: "Queue overview",
    title: "Queue overview",
    text:
      "Future queue cards are review units, not simple TODO items. Each item keeps the request, response expectation, run observability, validation state, Git review, notes, artifacts, and operator decision visible.",
    metrics: [
      { label: "Needs review", value: "1 static" },
      { label: "Running / queued", value: "1 static" },
      { label: "Failed / blocked", value: "1 static" },
      { label: "Accepted", value: "1 static" },
    ],
  },
  groups: [
    {
      badgeLabel: "1",
      badgeVariant: "warning",
      description:
        "Completed block previews that require explicit operator review before acceptance.",
      title: "Needs review",
      items: [
        {
          block: "Block 72",
          decision: { label: "Review Git / Accept planned" },
          git: "3 changed files",
          requestTemplate: "Codex implementation block",
          responseTemplate: "Implementation result",
          run: "Result Report planned",
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
      description:
        "Queued or running block previews. No executor is connected in this placeholder.",
      title: "Running / queued",
      items: [
        {
          block: "Block 73",
          decision: { label: "Open run planned" },
          git: "Not linked",
          requestTemplate: "Planning block",
          responseTemplate: "Plan result",
          run: "Overview log planned",
          status: {
            label: "Running planned",
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
      description:
        "Blocked previews keep failed validation and missing context visible.",
      title: "Failed / blocked",
      items: [
        {
          block: "Block 74",
          decision: { label: "Needs fix planned" },
          git: "Dirty state visible planned",
          requestTemplate: "Parser implementation block",
          responseTemplate: "Implementation result",
          run: "Raw Log planned",
          status: {
            label: "Blocked planned",
            variant: "error",
          },
          title: "Template response parser",
          validation: "Failed placeholder",
        },
      ],
    },
    {
      badgeLabel: "1",
      badgeVariant: "success",
      description:
        "Accepted previews show completed review state without implying auto-acceptance.",
      title: "Accepted / completed",
      items: [
        {
          block: "Block 70",
          decision: { label: "Accepted by operator planned" },
          git: "Clean after commit",
          requestTemplate: "Docs-only block",
          responseTemplate: "Implementation result",
          run: "Result Report archived planned",
          status: {
            label: "Accepted planned",
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
      "Static representative detail preview only. Queue item selection, item persistence, response capture, response validation, Git association, and working actions are not implemented.",
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
          value:
            "Generated prompt snapshot summary planned; no request generation exists.",
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
          value: "Static overview summary planned for quick review.",
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
          value: "Implementation result summary planned.",
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
          value: "Dirty placeholder from linked review context planned.",
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
          value: "Produced artifacts planned; no artifact storage exists.",
        },
        {
          label: "Notes / Notebook",
          value: "Related review notes planned; notes are not linked here.",
        },
      ],
    },
    decision: {
      title: "Decision",
      fields: [
        {
          label: "Recommendation",
          value: "Review Git / Accept planned",
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
  plannedActions: [
    { label: "Open request planned" },
    { label: "Open run planned" },
    { label: "Review Git planned" },
    { label: "Accept planned" },
    { label: "Needs fix planned" },
    { label: "Rerun planned" },
    { label: "Create follow-up planned" },
  ],
} satisfies AgentQueuePreview;
