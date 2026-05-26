import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_COORDINATOR_SAMPLE_PROPOSALS,
  type CoordinatorActionProposal,
} from "./coordinatorActionProposalRegistry";
import { WorkspaceAgentTranscript } from "./WorkspaceAgentTranscript";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("WorkspaceAgentTranscript", () => {
  it("renders empty-state suggestions and inserts only the selected prompt", () => {
    const onSuggestionClick = vi.fn();

    renderTranscript({
      messages: [],
      onSuggestionClick,
      suggestedPrompts: [
        { label: "Make a plan", prompt: "Make a plan from visible text." },
      ],
    });

    expect(
      document.querySelector('[aria-label="Local Workspace Agent transcript"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Workspace Agent suggested prompts"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Make a plan");

    act(() => {
      buttonWithText("Make a plan")?.click();
    });

    expect(onSuggestionClick).toHaveBeenCalledWith(
      "Make a plan from visible text.",
    );
  });

  it("renders messages and proposal cards with the existing transcript selectors", () => {
    const onApproveProposal = vi.fn();
    const proposal = LOCAL_COORDINATOR_SAMPLE_PROPOSALS[0];

    renderTranscript({
      messages: [
        {
          body: "Operator request.",
          id: "operator-1",
          role: "operator",
        },
        {
          body: "Assistant response.",
          id: "assistant-1",
          proposalIds: [proposal.id],
          role: "assistant",
        },
      ],
      onApproveProposal,
      proposals: {
        [proposal.id]: proposal,
      },
    });

    expect(
      document.querySelector('[data-testid="interactive-agent-message-operator"]')
        ?.textContent,
    ).toContain("Operator request.");
    expect(
      document.querySelector('[data-testid="interactive-agent-message-assistant"]')
        ?.textContent,
    ).toContain("Assistant response.");
    expect(document.body.textContent).toContain("Draft Queue task");
    expect(document.body.textContent).toContain(proposal.title);

    act(() => {
      buttonWithText("Approve")?.click();
    });

    expect(onApproveProposal).toHaveBeenCalledWith(proposal.id);
  });

  it("renders multi-draft review controls without creating Queue work", () => {
    const onApproveAllQueueDrafts = vi.fn();
    const proposals = queueDraftProposals();

    renderTranscript({
      messages: [
        {
          body: "Assistant response.",
          id: "assistant-1",
          proposalIds: Object.keys(proposals),
          role: "assistant",
        },
      ],
      onApproveAllQueueDrafts,
      proposals,
    });

    expect(document.body.textContent).toContain("2 drafted, 0 approved, 0 created.");
    expect(document.body.textContent).toContain(
      "Approve all drafts is local review only.",
    );

    act(() => {
      buttonWithText("Approve all drafts")?.click();
    });

    expect(onApproveAllQueueDrafts).toHaveBeenCalledWith(Object.keys(proposals));
  });
});

type TranscriptProps = Parameters<typeof WorkspaceAgentTranscript>[0];

function renderTranscript(overrides: Partial<TranscriptProps> = {}) {
  const props: TranscriptProps = {
    creatingKnowledgeDocumentProposalIds: new Set(),
    creatingNoteProposalIds: new Set(),
    creatingQueueProposalIds: new Set(),
    messages: [],
    onApproveAllQueueDrafts: vi.fn(),
    onApproveProposal: vi.fn(),
    onCreateKnowledgeDocument: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateQueueTask: vi.fn(),
    onCreateSkill: vi.fn(),
    onEditProposal: vi.fn(),
    onRejectProposal: vi.fn(),
    onSuggestionClick: vi.fn(),
    plans: {},
    proposals: {},
    reviews: {},
    suggestedPrompts: [],
    transcriptRef: null,
    ...overrides,
  };

  render(<WorkspaceAgentTranscript {...props} />);
}

function queueDraftProposals(): Record<string, CoordinatorActionProposal> {
  const base = LOCAL_COORDINATOR_SAMPLE_PROPOSALS[0];
  const first: CoordinatorActionProposal = {
    ...base,
    id: "queue-draft-1",
    title: "First draft task",
  };
  const second: CoordinatorActionProposal = {
    ...base,
    id: "queue-draft-2",
    title: "Second draft task",
  };

  return {
    [first.id]: first,
    [second.id]: second,
  };
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find(
    (button): button is HTMLButtonElement => button.textContent === text,
  );
}

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });
}
