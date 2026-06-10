import type { ReactNode } from "react";

import { Badge } from "../../design-system/Badge";
import { EmptyState } from "../../design-system/EmptyState";
import { ActionFact } from "../WorkspaceAgentQueueActionCardShared";
import type { PromptPackImportPreviewModel } from "./promptPackModel";

type PromptPackImportPreviewProps = {
  preview: PromptPackImportPreviewModel | null;
};

export function PromptPackImportPreview({ preview }: PromptPackImportPreviewProps) {
  if (!preview) {
    return (
      <EmptyState
        text="No prompt-pack parser entries have been supplied. Local folder and zip import are unavailable in this block."
        title="Prompt-pack preview unavailable"
      />
    );
  }

  const graph = preview.dependencyGraphSummary;

  return (
    <section
      aria-label="Prompt pack import preview"
      className="workspace-agent-queue-action-card prompt-pack-import-preview"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Prompt-pack import preview</p>
          <h4 className="coordinator-proposal-title">{preview.pack.name}</h4>
          <p className="coordinator-proposal-note">{preview.pack.id}</p>
        </div>
        <div className="coordinator-proposal-badges">
          <Badge variant={preview.importAvailable ? "success" : "error"}>
            {preview.importAvailable ? "Ready to review" : "Blocked"}
          </Badge>
          <Badge
            title={preview.sourceAdapter.message}
            variant={preview.sourceAdapter.kind === "available" ? "info" : "warning"}
          >
            {preview.sourceAdapter.kind === "available" ? "Source ready" : "Source unavailable"}
          </Badge>
        </div>
      </div>

      <dl className="workspace-agent-queue-action-card-facts">
        <ActionFact label="Items" value={preview.itemCount.toString()} />
        <ActionFact label="Selected" value={preview.selectedItemIds.length.toString()} />
        <ActionFact label="Dependencies" value={graph.edgeCount.toString()} />
        <ActionFact
          label="Unresolved deps"
          value={graph.unresolvedDependencyCount.toString()}
        />
        <ActionFact label="Validation commands" value={preview.validationCommands.length.toString()} />
        <ActionFact label="Model routes" value={preview.modelRouting.length.toString()} />
      </dl>

      <PreviewSection label="Selected items">
        <ul className="workspace-agent-queue-action-card-list">
          {preview.selectedItems.map((item) => (
            <li key={item.id}>
              {item.id}: {item.title}
            </li>
          ))}
        </ul>
      </PreviewSection>

      <PreviewSection label="Dependency graph summary">
        <dl className="workspace-agent-queue-action-card-facts">
          <ActionFact label="Roots" value={graph.rootItemCount.toString()} />
          <ActionFact label="Leaves" value={graph.leafItemCount.toString()} />
          <ActionFact label="Max depth" value={graph.maxDepth.toString()} />
          <ActionFact label="Cycles" value={graph.hasCycles ? "Yes" : "No"} />
          <ActionFact
            label="Selected blockers"
            value={graph.blockedSelectedItemCount.toString()}
          />
          <ActionFact
            label="Selected/total"
            value={`${graph.selectedItemCount.toString()} / ${graph.totalItemCount.toString()}`}
          />
        </dl>
      </PreviewSection>

      <PreviewSection label="Unresolved dependencies">
        <DiagnosticList
          diagnostics={preview.unresolvedDependencies}
          emptyLabel="No unresolved or unselected dependencies."
        />
      </PreviewSection>

      <PreviewSection label="Expected commit titles">
        <CompactList
          emptyLabel="No expected commit titles declared."
          items={preview.expectedCommitTitles}
        />
      </PreviewSection>

      <PreviewSection label="Validation commands">
        <CompactList
          emptyLabel="No validation commands declared."
          items={preview.validationCommands}
        />
      </PreviewSection>

      <PreviewSection label="Model routing">
        {preview.modelRouting.length ? (
          <ul className="workspace-agent-queue-action-card-list">
            {preview.modelRouting.map((route) => (
              <li
                key={`${route.modelProfile}/${route.reasoningEffort}/${route.validatorProfile}`}
              >
                {route.modelProfile} / {route.reasoningEffort} /{" "}
                {route.validatorProfile}: {route.itemIds.join(", ")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="coordinator-proposal-note">No selected model routes.</p>
        )}
      </PreviewSection>

      <PreviewSection label="Warnings">
        <DiagnosticList
          diagnostics={preview.warnings}
          emptyLabel="No nonblocking warnings."
        />
      </PreviewSection>

      <PreviewSection label="Errors">
        <DiagnosticList
          diagnostics={preview.errors}
          emptyLabel="No blocking errors."
        />
      </PreviewSection>

      <p className="coordinator-proposal-note">
        Preview is read-only. It does not create Queue items, assign workers, run
        tasks, finalize results, commit, or push.
      </p>
    </section>
  );
}

function PreviewSection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="coordinator-proposal-section">
      <p className="coordinator-proposal-section-label">{label}</p>
      {children}
    </div>
  );
}

function CompactList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: readonly string[];
}) {
  if (!items.length) {
    return <p className="coordinator-proposal-note">{emptyLabel}</p>;
  }

  return (
    <ul className="workspace-agent-queue-action-card-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function DiagnosticList({
  diagnostics,
  emptyLabel,
}: {
  diagnostics: PromptPackImportPreviewModel["errors"];
  emptyLabel: string;
}) {
  if (!diagnostics.length) {
    return <p className="coordinator-proposal-note">{emptyLabel}</p>;
  }

  return (
    <ul className="workspace-agent-queue-action-card-list">
      {diagnostics.map((diagnostic) => (
        <li
          key={`${diagnostic.severity}-${diagnostic.code}-${
            diagnostic.itemId ?? ""
          }-${diagnostic.message}`}
        >
          {diagnostic.severity}: {diagnostic.message}
        </li>
      ))}
    </ul>
  );
}
