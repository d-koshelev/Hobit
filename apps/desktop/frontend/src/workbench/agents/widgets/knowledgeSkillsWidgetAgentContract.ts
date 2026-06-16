import {
  createWidgetAgentContract,
  createWidgetSelfTestInstruction,
} from "./hobitWidgetAgentContract";
import { widgetCapability } from "./widgetAgentContractHelpers";

const knowledgeSelfTestInstruction = createWidgetSelfTestInstruction({
  body: [
    "Run the Knowledge / Skills widget contract self-test through contract metadata only.",
    "Confirm the contract exists and declares list, search, and preview capabilities.",
    "Confirm import, draft creation, and use-as-context capabilities are confirmation-gated, dry-run/preview-gated, or unavailable until an adapter exists.",
    "Do not import files, create records, attach context, call Codex or shell, launch Terminal, mutate Git, execute rollback, start Queue workers, or read hidden context.",
    "Return structured passed, failed, skipped, or blocked evidence.",
  ].join(" "),
  id: "skill-library.selfTest",
  title: "Knowledge / Skills widget self-test",
});

export const KNOWLEDGE_SKILLS_WIDGET_AGENT_CONTRACT = createWidgetAgentContract({
  availability: { status: "available" },
  capabilities: [
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.list.requested"],
      capabilityId: "knowledge.list",
      confirmationRequirement: "none",
      description:
        "List visible Knowledge Documents and Skills where the manual Knowledge / Skills widget data bridge is available.",
      forbiddenSideEffects: knowledgeForbiddenSideEffects(),
      inputSchemaDescription:
        "Workspace id, optional scope filter, item type filter, enabled/searchable filters, and pagination bounds.",
      outputSchemaDescription:
        "Bounded catalog item summaries with type, scope, lifecycle, enabled/searchable state, tags, source labels, and warnings.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "List Knowledge Items",
      unavailableReason: knowledgeAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.search.requested"],
      capabilityId: "knowledge.search",
      confirmationRequirement: "none",
      description:
        "Search or filter visible Knowledge Documents and Skills through the widget-owned catalog/search model.",
      forbiddenSideEffects: knowledgeForbiddenSideEffects(),
      inputSchemaDescription:
        "Explicit search text plus optional scope, type, lifecycle, enabled/searchable, and tag filters.",
      outputSchemaDescription:
        "Bounded matching Knowledge / Skills summaries and unavailable or capped-state warnings.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Search Knowledge Items",
      unavailableReason: knowledgeAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.previewItem.requested"],
      capabilityId: "knowledge.previewItem",
      confirmationRequirement: "none",
      description:
        "Preview selected Knowledge Document or Skill details that the current visible widget can show.",
      forbiddenSideEffects: knowledgeForbiddenSideEffects(),
      inputSchemaDescription:
        "Selected Knowledge Document id or Skill id plus explicit preview bounds.",
      outputSchemaDescription:
        "Selected item details, summary, source metadata, lifecycle/review state, tags, and capped content preview where visible.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Preview Knowledge Item",
      unavailableReason: knowledgeAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.useAsContext.requested"],
      capabilityId: "knowledge.useAsContext",
      confirmationRequirement: "recommended",
      description:
        "Attach a selected saved Knowledge Document or Skill as visible Workspace Agent or Queue task context where the manual widget exposes that action.",
      forbiddenSideEffects: [
        "hidden_context_attach",
        "automatic_provider_prompt_injection",
        ...knowledgeForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Selected saved Knowledge Document or Skill id, explicit target surface, bounded snapshot preference, and operator-visible reason.",
      outputSchemaDescription:
        "Visible context attachment result, capped snapshot metadata, target surface, warnings, and audit events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Use Knowledge Item As Context",
      unavailableReason: knowledgeAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.importFile.requested"],
      capabilityId: "knowledge.importFile",
      confirmationRequirement: "required",
      description:
        "Import one explicit plain text or Markdown file into a Knowledge Document through the manual widget import flow.",
      forbiddenSideEffects: [
        "folder_scan",
        "binary_parse",
        "hidden_file_read",
        ...knowledgeForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Operator-selected single file handle/path, target scope, title/source metadata, tags, lifecycle state, and dry-run flag.",
      outputSchemaDescription:
        "Import preview or created Knowledge Document summary with file type, size/cap warnings, source metadata, and audit events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Import Knowledge File",
      unavailableReason: knowledgeAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.createDraft.requested"],
      capabilityId: "knowledge.createDraft",
      confirmationRequirement: "required",
      description:
        "Create a visible Knowledge Document or Skill draft from explicit visible input for later operator review.",
      forbiddenSideEffects: [
        "hidden_source_read",
        "automatic_acceptance",
        "automatic_enable",
        ...knowledgeForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Explicit visible title/body or Skill fields, target record kind, source label, scope, tags, and draft/review state.",
      outputSchemaDescription:
        "Draft preview or created draft summary with review state, source metadata, warnings, and audit events.",
      sideEffectLevel: "write",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Create Knowledge Draft",
      unavailableReason: knowledgeAdapterUnavailableReason(),
    }),
    widgetCapability({
      auditEventNames: ["hobit.widget.knowledge.selfTest.requested"],
      capabilityId: "knowledge.selfTest",
      confirmationRequirement: "none",
      description:
        "Run metadata-only Knowledge / Skills contract checks without reading hidden records or mutating Knowledge data.",
      forbiddenSideEffects: [
        "knowledge_record_create",
        "knowledge_record_update",
        "knowledge_record_delete",
        "context_attach",
        ...knowledgeForbiddenSideEffects(),
      ],
      inputSchemaDescription:
        "Contract self-test request with dry-run flag and expected hidden side-effect assertions.",
      outputSchemaDescription:
        "Self-test report with contract evidence and skipped or blocked adapter checks.",
      sideEffectLevel: "read",
      supportsDryRun: true,
      supportsPreview: true,
      title: "Knowledge / Skills Self-Test",
    }),
  ],
  expectedResultDescription:
    "Knowledge / Skills self-tests validate contract metadata, list/search/preview declarations, gated write/import/context actions, and adapter-unavailable status without reading or mutating records.",
  hiddenSideEffectAssertions: [
    "no_hidden_context_read",
    "no_hidden_ingestion",
    "no_knowledge_mutation",
    "no_context_attach",
    "no_shell_command",
    "no_codex_run",
    "no_terminal_launch",
    "no_git_mutation",
    "no_queue_worker_start",
    "no_rollback_execution",
  ],
  ownerModule: "apps/desktop/frontend/src/workbench/agents/widgets",
  ownerSurface: "Knowledge / Skills",
  productDescription:
    "Knowledge / Skills uses the saved-compatible skill-library widget identity. The current product surface can browse and filter a unified catalog of workspace/global Knowledge Documents and workspace Skills, preview item details, create and edit records through explicit widget flows, import one plain text or Markdown file, review draft packs, delete supported records through visible controls, and attach selected saved items as visible Workspace Agent or Queue task context. This Widget Agent Contract is metadata-only: no Knowledge / Skills agent adapter, hidden memory, embeddings, folder scan, binary parsing, automatic context injection, or provider/tool execution is implemented.",
  selfTestCases: [
    {
      capabilityId: "knowledge.selfTest",
      caseId: "knowledge:contract-exists",
      expectedResultDescription:
        "The Knowledge / Skills contract exists with product description, capabilities, and self-test instruction.",
      hiddenSideEffectAssertions: ["no_capability_inference"],
      title: "Contract Exists",
    },
    {
      capabilityId: "knowledge.list",
      caseId: "knowledge:read-capabilities-declared",
      expectedResultDescription:
        "List, search, and preview capabilities are declared as read-only and unavailable until a widget adapter exists.",
      hiddenSideEffectAssertions: ["no_hidden_context_read"],
      title: "Read Capabilities Declared",
    },
    {
      capabilityId: "knowledge.importFile",
      caseId: "knowledge:write-capabilities-gated",
      expectedResultDescription:
        "Import, draft creation, and use-as-context capabilities are dry-run/preview/confirmation-gated or unavailable.",
      hiddenSideEffectAssertions: ["no_knowledge_mutation", "no_context_attach"],
      title: "Write Capabilities Gated",
    },
    {
      capabilityId: "knowledge.selfTest",
      caseId: "knowledge:no-hidden-side-effects",
      expectedResultDescription:
        "Self-test does not import files, create records, attach context, run shell/Codex/Terminal/Git, start Queue workers, or execute rollback.",
      hiddenSideEffectAssertions: [
        "no_shell_command",
        "no_codex_run",
        "no_terminal_launch",
        "no_git_mutation",
        "no_queue_worker_start",
        "no_rollback_execution",
      ],
      title: "No Hidden Side Effects",
    },
  ],
  selfTestInstruction: knowledgeSelfTestInstruction,
  title: "Knowledge / Skills",
  widgetId: "skill-library",
});

function knowledgeAdapterUnavailableReason() {
  return [
    "Knowledge / Skills Widget Agent adapter is not implemented yet.",
    "The manual widget supports these product flows, but agent execution must be reported as skipped or blocked.",
    "Self-test metadata only.",
  ].join(" ");
}

function knowledgeForbiddenSideEffects() {
  return [
    "hidden_context_read",
    "hidden_ingestion",
    "hidden_workspace_scan",
    "automatic_provider_prompt_injection",
    "knowledge_record_create_without_confirmation",
    "knowledge_record_update_without_confirmation",
    "knowledge_record_delete",
    "embeddings",
    "vector_indexing",
    "folder_scan",
    "binary_parse",
    "notes_read",
    "evidence_creation",
    "context_pack_creation",
    "queue_worker_start",
    "codex_run",
    "shell_command",
    "terminal_launch",
    "git_mutation",
    "rollback_execution",
  ];
}
