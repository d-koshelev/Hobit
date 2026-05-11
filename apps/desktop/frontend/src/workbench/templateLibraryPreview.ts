export type PreviewField = {
  label: string;
  value: string;
};

export type PreviewStep = {
  detail: string;
  title: string;
};

export type PreviewAction = {
  label: string;
};

export type TemplatePreviewSection = {
  badgeLabel: string;
  items: string[];
  title: string;
};

type StaticPreviewBase = {
  ariaLabel: string;
  badges: string[];
  description: string;
  heading: string;
  title: string;
};

export type RequestTemplatePreview = StaticPreviewBase & {
  fields: PreviewField[];
};

export type ResponseTemplatePreview = StaticPreviewBase & {
  fields: PreviewField[];
};

export type CoordinatorWorkflowPreview = StaticPreviewBase & {
  steps: PreviewStep[];
};

export type TemplateLibraryPreviewModel = {
  coordinatorWorkflow: CoordinatorWorkflowPreview;
  plannedActions: PreviewAction[];
  plannedSections: TemplatePreviewSection[];
  requestTemplate: RequestTemplatePreview;
  responseTemplate: ResponseTemplatePreview;
  summary: {
    badgeLabel: string;
    text: string;
    title: string;
  };
};

export const templateLibraryPreview = {
  summary: {
    title: "Template Library",
    text:
      "Request and Response Templates are planned. A local generated request preview is available, but template editing, saved request generation, executor threads, response capture, parsing, validation, and Git association are not available yet.",
    badgeLabel: "Local preview",
  },
  requestTemplate: {
    ariaLabel: "Static Request Template preview",
    heading: "Request Template Preview",
    title: "Codex implementation block",
    description:
      "Static example only. It is not editable, persisted, generated, copied, sent to an executor, or connected to variables.",
    badges: ["Static", "Planned"],
    fields: [
      {
        label: "Block",
        value: "Numbered executor block with a short implementation title.",
      },
      {
        label: "Goal",
        value: "Concrete outcome the executor must deliver.",
      },
      {
        label: "Context",
        value:
          "Relevant product boundary, contracts, and current implementation notes.",
      },
      {
        label: "Scope",
        value: "Focused work area and explicit placeholder-only limits.",
      },
      {
        label: "Likely files",
        value: "Expected files or modules to inspect before editing.",
      },
      {
        label: "Do not change",
        value: "Protected systems, runtime behavior, storage, and dependencies.",
      },
      {
        label: "Implementation requirements",
        value: "Ordered requirements the executor must satisfy.",
      },
      {
        label: "Safety rules",
        value: "Stop conditions and forbidden scope expansion.",
      },
      {
        label: "Validation",
        value: "Required automated checks and manual check reporting.",
      },
      {
        label: "Commit",
        value: "One focused commit message suggestion.",
      },
      {
        label: "Final response",
        value: "Files changed, validation, warnings, commit, and final git status.",
      },
    ],
  },
  responseTemplate: {
    ariaLabel: "Static Response Template preview",
    heading: "Response Template Preview",
    title: "Implementation result",
    description:
      "Static example only. It is not editable, persisted, captured, parsed, validated, or connected to executor agents. No-code audit and failed/blocked results are separate planned response kinds.",
    badges: ["Static", "Planned"],
    fields: [
      {
        label: "Header",
        value: "Starts with the block number and title, such as Block 62.",
      },
      {
        label: "Files changed",
        value: "Lists the exact files touched by the implementation block.",
      },
      {
        label: "What changed",
        value: "Summarizes the delivered work without claiming extra behavior.",
      },
      {
        label: "Validation results",
        value: "Reports every requested command as passed, failed, or not run.",
      },
      {
        label: "Warnings",
        value: "Calls out skipped checks, failures, caveats, and residual risk.",
      },
      {
        label: "Commit",
        value: "Includes hash and message, or says plainly when commit failed.",
      },
      {
        label: "Out of scope",
        value: "Names work intentionally not implemented by the block.",
      },
      {
        label: "Final git status",
        value: "Reports final branch and working-tree state after the task.",
      },
    ],
  },
  coordinatorWorkflow: {
    ariaLabel: "Static Coordinator Workflow preview",
    heading: "Coordinator Workflow Preview",
    title: "Future executor block flow",
    description:
      "Static planned flow only. It does not generate requests, launch executor tasks, capture responses, validate responses, or link Git review state.",
    badges: ["Static", "Planned"],
    steps: [
      {
        title: "Select Request Template",
        detail:
          "Choose the future template that will become the executor prompt for one block.",
      },
      {
        title: "Fill variables",
        detail:
          "Provide block scope, context, exclusions, validation, and the paired Response Template.",
      },
      {
        title: "Preview executor request",
        detail:
          "Review the generated prompt before it is copied, sent, or handed to an executor.",
      },
      {
        title: "Start fresh executor thread/task",
        detail:
          "Run one new executor task per block so prior strategy does not become hidden scope.",
      },
      {
        title: "Capture executor response",
        detail:
          "Record the final report that should follow the selected Response Template.",
      },
      {
        title: "Validate response against Response Template",
        detail:
          "Check required sections, skipped validation, failed commands, warnings, and commit reporting.",
      },
      {
        title: "Review Git state",
        detail:
          "Use the Git Widget as the post-code-block review surface for changes, validation, and commits.",
      },
      {
        title: "Accept / Fix / Next block",
        detail:
          "Coordinator and operator decide whether to accept, request a fix, rerun, or create the next block.",
      },
    ],
  },
  plannedSections: [
    {
      title: "Request Templates",
      badgeLabel: "Planned",
      items: ["Codex implementation block", "Audit block", "Bugfix block"],
    },
    {
      title: "Response Templates",
      badgeLabel: "Planned",
      items: [
        "Implementation result",
        "No-code audit result",
        "Failed/blocked result",
      ],
    },
  ],
  plannedActions: [
    { label: "Copy request planned" },
    { label: "Send to executor planned" },
    { label: "Validate response planned" },
  ],
} satisfies TemplateLibraryPreviewModel;
