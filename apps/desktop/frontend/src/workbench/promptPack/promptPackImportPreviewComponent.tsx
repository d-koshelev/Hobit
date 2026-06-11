import type { ReactNode } from "react";

import { Badge } from "../../design-system/Badge";
import { Button } from "../../design-system/Button";
import { EmptyState } from "../../design-system/EmptyState";
import { ActionFact } from "../WorkspaceAgentQueueActionCardShared";
import type { PromptPackImportPreviewModel } from "./promptPackModel";

type PromptPackImportPreviewProps = {
  preview: PromptPackImportPreviewModel | null;
};

export type PromptPackImportPreviewCardAction = {
  disabled: boolean;
  disabledReason?: string | null;
  isPending?: boolean;
  label: string;
  onClick: () => void;
};

export type PromptPackImportPreviewCardActions = {
  cancel: PromptPackImportPreviewCardAction;
  create: PromptPackImportPreviewCardAction;
};

type PromptPackImportPreviewCardProps = PromptPackImportPreviewProps & {
  actions?: PromptPackImportPreviewCardActions;
};

export function PromptPackImportPreview({ preview }: PromptPackImportPreviewProps) {
  return <PromptPackImportPreviewCard preview={preview} />;
}

export function PromptPackImportPreviewCard({
  actions,
  preview,
}: PromptPackImportPreviewCardProps) {
  if (!preview) {
    return (
      <section
        aria-label="Prompt-pack import preview card"
        className="workspace-agent-queue-action-card prompt-pack-import-preview"
      >
        <div className="workspace-agent-queue-action-card-header">
          <div>
            <p className="coordinator-proposal-kicker">
              Prompt-pack import preview
            </p>
            <h4 className="coordinator-proposal-title">
              Prompt-pack preview unavailable
            </h4>
          </div>
          <Badge variant="warning">Needs source</Badge>
        </div>
        <EmptyState
          text="No prompt-pack parser entries have been supplied. Local folder and zip import are unavailable in this block."
          title="No preview source"
        />
        <PreviewActions actions={actions} />
      </section>
    );
  }

  const graph = preview.dependencyGraphSummary;
  const packDescription =
    preview.pack.description?.trim() ||
    "No pack description supplied by the prompt-pack manifest.";

  return (
    <section
      aria-label="Prompt-pack import preview card"
      className="workspace-agent-queue-action-card prompt-pack-import-preview"
    >
      <div className="workspace-agent-queue-action-card-header">
        <div>
          <p className="coordinator-proposal-kicker">Prompt-pack import preview</p>
          <h4 className="coordinator-proposal-title">{preview.pack.name}</h4>
          <p className="coordinator-proposal-note">{packDescription}</p>
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
        <ActionFact label="Pack id" value={preview.pack.id} />
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
              {item.id}: {item.title} | Tags: {listSummary(item.tags, "none")} |
              Priority: {item.priority.toString()} | Dependencies:{" "}
              {listSummary(item.dependencies, "none")} | Validation:{" "}
              {listSummary(item.validationCommands, "none")} | Allowed scope:{" "}
              {listSummary(item.allowedScope, "not declared")} | Forbidden scope:{" "}
              {listSummary(item.forbiddenScope, "not declared")}
            </li>
          ))}
        </ul>
      </PreviewSection>

      <PreviewSection label="Item dependencies">
        <ul className="workspace-agent-queue-action-card-list">
          {preview.selectedItems.map((item) => (
            <li key={`${item.id}-dependencies`}>
              {item.id}: {dependencySummary(item.dependencies)}
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

      <PreviewSection label="Allowed scope">
        <ScopedItemList
          emptyLabel="No allowed scope declared."
          items={preview.selectedItems.map((item) => ({
            id: item.id,
            values: item.allowedScope,
          }))}
        />
      </PreviewSection>

      <PreviewSection label="Forbidden scope">
        <ScopedItemList
          emptyLabel="No forbidden scope declared."
          items={preview.selectedItems.map((item) => ({
            id: item.id,
            values: item.forbiddenScope,
          }))}
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
      <PreviewActions actions={actions} />
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

function ScopedItemList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: Array<{ id: string; values: readonly string[] }>;
}) {
  const scopedItems = items.filter((item) => item.values.length > 0);
  if (!scopedItems.length) {
    return <p className="coordinator-proposal-note">{emptyLabel}</p>;
  }

  return (
    <ul className="workspace-agent-queue-action-card-list">
      {scopedItems.map((item) => (
        <li key={item.id}>
          {item.id}: {item.values.join(", ")}
        </li>
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

function PreviewActions({
  actions,
}: {
  actions: PromptPackImportPreviewCardActions | undefined;
}) {
  if (!actions) {
    return null;
  }

  return (
    <>
      <div className="coordinator-proposal-actions">
        <Button
          disabled={actions.create.disabled}
          onClick={actions.create.onClick}
          title={actions.create.disabledReason ?? undefined}
          variant="primary"
        >
          {actions.create.isPending ? "Creating" : actions.create.label}
        </Button>
        <Button
          disabled={actions.cancel.disabled}
          onClick={actions.cancel.onClick}
          title={actions.cancel.disabledReason ?? undefined}
          variant="ghost"
        >
          {actions.cancel.label}
        </Button>
      </div>
      {actions.create.disabled && actions.create.disabledReason ? (
        <p className="workspace-agent-queue-intent-validation">
          {actions.create.disabledReason}
        </p>
      ) : null}
    </>
  );
}

function dependencySummary(dependencies: readonly string[]) {
  return dependencies.length ? `Depends on ${dependencies.join(", ")}` : "No dependencies";
}

function listSummary(values: readonly string[], emptyLabel: string) {
  return values.length ? values.join(", ") : emptyLabel;
}
