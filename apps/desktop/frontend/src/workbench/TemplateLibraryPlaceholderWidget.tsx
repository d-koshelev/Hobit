import { useMemo, useState } from "react";
import { Badge } from "../design-system/Badge";
import { WidgetFrame } from "../design-system/WidgetFrame";
import {
  CoordinatorWorkflowPreviewSection,
  TemplateLibraryGeneratedRequestPreviewSection,
  RequestTemplatePreviewSection,
  ResponseTemplatePreviewSection,
  TemplateLibraryPlannedActions,
  TemplateLibraryPlannedSections,
  TemplateLibrarySummarySection,
} from "./TemplateLibraryPlaceholderSections";
import { templateLibraryPreview } from "./templateLibraryPreview";
import type { WidgetRenderProps } from "./types";
import type {
  GeneratedRequestPreviewField,
  GeneratedRequestPreviewInputs,
} from "./TemplateLibraryPlaceholderSections";

const initialGeneratedRequestInputs: GeneratedRequestPreviewInputs = {
  blockNumber: "",
  blockTitle: "",
  goal: "",
  scope: "",
  commitMessage: "",
  extraContextNote: "",
};

export function TemplateLibraryPlaceholderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const [generatedRequestInputs, setGeneratedRequestInputs] =
    useState<GeneratedRequestPreviewInputs>(initialGeneratedRequestInputs);

  const generatedRequestPreviewText = useMemo(
    () => buildGeneratedRequestPreview(generatedRequestInputs),
    [generatedRequestInputs],
  );

  const handleGeneratedRequestInputChange = (
    field: GeneratedRequestPreviewField,
    value: string,
  ) => {
    setGeneratedRequestInputs((currentInputs) => ({
      ...currentInputs,
      [field]: value,
    }));
  };

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="neutral">Placeholder</Badge>}
      title={title}
    >
      <div className="template-library-placeholder">
        <TemplateLibrarySummarySection summary={templateLibraryPreview.summary} />
        <RequestTemplatePreviewSection
          preview={templateLibraryPreview.requestTemplate}
        />
        <TemplateLibraryGeneratedRequestPreviewSection
          inputs={generatedRequestInputs}
          onInputChange={handleGeneratedRequestInputChange}
          previewText={generatedRequestPreviewText}
          requestTemplateTitle={templateLibraryPreview.requestTemplate.title}
        />
        <ResponseTemplatePreviewSection
          preview={templateLibraryPreview.responseTemplate}
        />
        <CoordinatorWorkflowPreviewSection
          preview={templateLibraryPreview.coordinatorWorkflow}
        />
        <TemplateLibraryPlannedSections
          sections={templateLibraryPreview.plannedSections}
        />
        <TemplateLibraryPlannedActions
          actions={templateLibraryPreview.plannedActions}
        />
      </div>
    </WidgetFrame>
  );
}

function buildGeneratedRequestPreview(inputs: GeneratedRequestPreviewInputs) {
  const fieldDefaults = new Map(
    templateLibraryPreview.requestTemplate.fields.map((field) => [
      field.label,
      field.value,
    ]),
  );

  const blockNumber = compactValue(inputs.blockNumber, "TBD");
  const blockTitle = compactValue(
    inputs.blockTitle,
    "Untitled implementation block",
  );
  const goal = compactValue(
    inputs.goal,
    fieldDefaults.get("Goal") ?? "Concrete outcome the executor must deliver.",
  );
  const scope = compactValue(
    inputs.scope,
    fieldDefaults.get("Scope") ??
      "Focused work area and explicit placeholder-only limits.",
  );
  const extraContextNote = compactValue(
    inputs.extraContextNote,
    "No extra context note provided.",
  );
  const commitMessage = compactValue(
    inputs.commitMessage,
    "Use one focused commit message for the block.",
  );

  return [
    "You are working in the Hobit repository.",
    `Template: ${templateLibraryPreview.requestTemplate.title}`,
    "Generated request status: local preview only; not saved, not copied/sent, and no executor launched.",
    "",
    `Block: Block ${blockNumber} - ${blockTitle}`,
    "",
    "Goal:",
    goal,
    "",
    "Context:",
    "- Hobit is a modular AI Workbench. The Workbench remains the product surface, and widgets are optional capabilities.",
    "- This preview uses the static Request Template Preview data for the Codex implementation block.",
    `- ${extraContextNote}`,
    "",
    "Scope:",
    scope,
    "",
    "Likely files:",
    "- Inspect the current Template Library placeholder widget, presentational sections, static preview data, and compact component styling before editing.",
    "",
    "Do not change:",
    "- Rust backend, Tauri commands, SQLite schema, Workspace API, storage, package dependencies, or runtime execution behavior.",
    "- Template storage, template editor behavior, response capture, response parsing, response validation, copy/send behavior, Agent Queue behavior, Agent Run behavior, Git behavior, Notes behavior, Terminal behavior, Dock behavior, layout move/resize, or floating behavior.",
    "",
    "Implementation requirements:",
    "1. Inspect current code and relevant contracts before editing.",
    "2. Keep generated request inputs as local React state only.",
    "3. Preserve the static Request Template Preview, Response Template Preview, Coordinator Workflow Preview, planned disabled actions, logs panel, layout editing, and float/dock behavior.",
    "4. Label the preview honestly as local-only, not saved, not copied/sent, and not executor-launched.",
    "5. Keep styling compact and token-based.",
    "",
    "Validation:",
    "- npm.cmd run typecheck --prefix apps/desktop/frontend",
    "- npm.cmd run build --prefix apps/desktop/frontend",
    "- cargo fmt --all",
    "- cargo check --workspace",
    "- cargo test --workspace",
    "- git diff --check",
    "- git status --short --branch",
    "- Report manual UI check status.",
    "",
    "Commit:",
    commitMessage,
    "",
    "Final response:",
    "- Files changed",
    "- What changed",
    "- Validation results",
    "- Warnings, if any",
    "- Manual check result, if performed",
    "- Commit hash and message",
    "- Out of scope / intentionally not implemented",
    "- Final git status",
  ].join("\n");
}

function compactValue(value: string, fallback: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : fallback;
}
