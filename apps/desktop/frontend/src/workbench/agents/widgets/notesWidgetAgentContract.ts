import {
  createWidgetAgentContract,
  createWidgetSelfTestInstruction,
} from "./hobitWidgetAgentContract";
import { widgetCapability } from "./widgetAgentContractHelpers";

const notesSelfTestInstruction = createWidgetSelfTestInstruction({
  body: [
    "Run the Notes widget contract self-test through contract metadata only.",
    "Confirm the contract exists and declares list/read capabilities.",
    "Confirm create and update capabilities are dry-run/confirmation-gated or unavailable until an adapter exists.",
    "Confirm preview checks are derived from explicit source text only and do not mutate real notes.",
    "Do not read hidden Notes, create or update notes, promote Knowledge, call Codex or shell, launch Terminal, mutate Git, execute rollback, or start Queue workers.",
    "Return structured passed, failed, skipped, or blocked evidence.",
  ].join(" "),
  id: "notes.selfTest",
  title: "Notes widget self-test",
});

export const NOTES_WIDGET_AGENT_CONTRACT = createWidgetAgentContract({
  availability: { status: "available" },
  capabilities: [
    widgetCapability({
      auditEventNames: ["hobit.widget.notes.list.requested"],
      capabilityId: "notes.list",
      confirmationRequirement: "none",
      description:
        "List workspace-local Notes summaries where the current Notes widget API is available.",
      forbiddenSideEffects: notesForbiddenSideEffects(),
      inputSchemaDescription:
        "Workspace id plus optional filter text and bounded result limit.",
      outputSchemaDescription:
        "Workspace Note summaries with id, title, pinned state, timestamps, and unavailable/capped warnings.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "List Notes",
      unavailableReason: notesAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.notes.read.requested"],
      capabilityId: "notes.read",
      confirmationRequirement: "none",
      description:
        "Read one selected workspace-local Note through the visible Notes widget boundary.",
      forbiddenSideEffects: notesForbiddenSideEffects(),
      inputSchemaDescription:
        "Workspace id, selected Note id, and explicit content preview bounds.",
      outputSchemaDescription:
        "Selected Note title/body/pinned fields with capped body preview and timestamps.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Read Note",
      unavailableReason: notesAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.notes.create.requested"],
      capabilityId: "notes.create",
      confirmationRequirement: "required",
      description:
        "Create one workspace-local Note from explicit visible title/body/pinned input.",
      forbiddenSideEffects: [
        "hidden_note_read",
        "automatic_knowledge_promotion",
        ...notesForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Visible note title, body source text, pinned flag, dry-run flag, and operator-visible reason.",
      outputSchemaDescription:
        "Create preview or created Note summary with id, title, pinned state, timestamps, and audit events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Create Note",
      unavailableReason: notesAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.notes.update.requested"],
      capabilityId: "notes.update",
      confirmationRequirement: "required",
      description:
        "Update the selected workspace-local Note title, body source text, or pinned state through an explicit save-style action.",
      forbiddenSideEffects: [
        "hidden_note_read",
        "autosave",
        "automatic_knowledge_promotion",
        ...notesForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Selected Note id, expected previous updated timestamp where available, replacement title/body/pinned fields, dry-run flag, and reason.",
      outputSchemaDescription:
        "Update preview or updated Note summary with timestamps, conflict/unavailable warnings, and audit events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Update Note",
      unavailableReason: notesAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.notes.previewMarkdown.requested"],
      capabilityId: "notes.previewMarkdown",
      confirmationRequirement: "none",
      description:
        "Preview explicit Notes source text using the current basic Markdown, fenced code, and JSON preview behavior.",
      forbiddenSideEffects: notesForbiddenSideEffects(),
      inputSchemaDescription:
        "Explicit source text supplied for preview, with optional preview bounds.",
      outputSchemaDescription:
        "Derived preview summary or rendered-block metadata without saving, formatting, or mutating note source text.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Preview Notes Markdown",
      unavailableReason: notesAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.notes.selfTest.requested"],
      capabilityId: "notes.selfTest",
      confirmationRequirement: "none",
      description:
        "Run metadata-only Notes contract checks without reading hidden Notes or mutating real notes.",
      forbiddenSideEffects: [
        "note_create",
        "note_update",
        "knowledge_promotion",
        ...notesForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Contract self-test request with dry-run flag and expected hidden side-effect assertions.",
      outputSchemaDescription:
        "Self-test report with contract evidence and skipped or blocked adapter checks.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Notes Self-Test",
    }),
  ],
  expectedResultDescription:
    "Notes self-tests validate contract metadata, read declarations, create/update gating, preview source safety, and adapter-unavailable status without mutating Notes.",
  hiddenSideEffectAssertions: [
    "no_hidden_note_read",
    "no_note_mutation",
    "no_knowledge_promotion",
    "no_shell_command",
    "no_codex_run",
    "no_terminal_launch",
    "no_git_mutation",
    "no_queue_worker_start",
    "no_rollback_execution",
  ],
  ownerModule: "apps/desktop/frontend/src/workbench/agents/widgets",
  ownerSurface: "Notes",
  productDescription:
    "Notes uses the notes widget identity for workspace-local Notes. The current product surface can list and filter notes, create a note, select/read a note, edit title/body/pinned source fields, save explicitly, show basic Markdown/code/JSON preview from source text, format note body text only when the operator clicks Format, and promote a saved selected note to a separate Knowledge Document through an explicit operator action. This Widget Agent Contract is metadata-only: no Notes agent adapter, hidden note reads, autosave, delete/archive UI, AI-in-Notes, automatic Knowledge promotion, Terminal/Git/JDBC execution, or hidden context access is implemented.",
  selfTestCases: [
    {
      capabilityId: "notes.selfTest",
      caseId: "notes:contract-exists",
      expectedResultDescription:
        "The Notes contract exists with product description, capabilities, and self-test instruction.",
      hiddenSideEffectAssertions: ["no_capability_inference"],
      title: "Contract Exists",
    },
    {
      capabilityId: "notes.list",
      caseId: "notes:read-capabilities-declared",
      expectedResultDescription:
        "List and read capabilities are declared as read-only and unavailable until a widget adapter exists.",
      hiddenSideEffectAssertions: ["no_hidden_note_read"],
      title: "Read Capabilities Declared",
    },
    {
      capabilityId: "notes.create",
      caseId: "notes:write-capabilities-gated",
      expectedResultDescription:
        "Create and update capabilities are dry-run/preview/confirmation-gated or unavailable.",
      hiddenSideEffectAssertions: ["no_note_mutation"],
      title: "Write Capabilities Gated",
    },
    {
      capabilityId: "notes.previewMarkdown",
      caseId: "notes:preview-no-mutation",
      expectedResultDescription:
        "Preview is derived from explicit source text and does not save, format, promote, or mutate real Notes.",
      hiddenSideEffectAssertions: ["no_note_mutation", "no_hidden_note_read"],
      title: "Preview No Mutation",
    },
  ],
  selfTestInstruction: notesSelfTestInstruction,
  title: "Notes",
  widgetId: "notes",
});

function notesAdapterUnavailableReason() {
  return [
    "Notes Widget Agent adapter is not implemented yet.",
    "The manual widget supports these product flows, but agent execution must be reported as skipped or blocked.",
    "Self-test metadata only.",
  ].join(" ");
}

function notesForbiddenSideEffects() {
  return [
    "hidden_note_read",
    "note_create_without_confirmation",
    "note_update_without_confirmation",
    "note_delete",
    "note_archive",
    "autosave",
    "automatic_knowledge_promotion",
    "automatic_context_use",
    "ai_note_rewrite",
    "remote_asset_load",
    "command_execution_from_note_text",
    "queue_item_create",
    "queue_worker_start",
    "codex_run",
    "shell_command",
    "terminal_launch",
    "git_mutation",
    "rollback_execution",
  ];
}
