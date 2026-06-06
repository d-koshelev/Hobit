import type {
  KnowledgeCatalogItemType,
  KnowledgeDocumentScope,
  KnowledgeScope,
  KnowledgeSourceRef,
} from "../workspace/types";

const KNOWLEDGE_DOCUMENT_TYPES: KnowledgeCatalogItemType[] = [
  "codebase_knowledge",
  "documentation_knowledge",
  "architecture_decision",
  "runbook",
  "skill",
  "prompt_template",
  "validation_rule",
  "known_issue",
  "workflow",
  "command_history_summary",
  "investigation_summary",
  "external_reference",
];

export type KnowledgeDraftTargetKind = "document" | "skill";

export type KnowledgeDraftReviewItem = {
  activationRecommendation: string;
  blockers: string;
  confidence: string;
  draftItemId: string;
  fullContent: string;
  quickSummary: string;
  relatedTasks: string[];
  reviewNotes: string;
  sourceLabel: string;
  sourceQueueItemId: string | null;
  sourceRef: string;
  sourceRefs: KnowledgeSourceRef[];
  suggestedScope: KnowledgeDocumentScope;
  suggestedTags: string;
  suggestedType: KnowledgeCatalogItemType;
  targetKind: KnowledgeDraftTargetKind;
  title: string;
};

export type KnowledgeDraftReviewPack = {
  draftPackId: string;
  generationGoal: string;
  packTitle: string;
  queueItemId: string | null;
  rawJson: string;
  sourceLabel: string;
  sourceRefs: KnowledgeSourceRef[];
  proposedItems: KnowledgeDraftReviewItem[];
};

export function parseKnowledgeDraftPackFromText(
  text: string,
): KnowledgeDraftReviewPack | null {
  const candidates = candidateValuesFromText(text);

  for (const candidate of candidates) {
    const pack = findDraftPack(candidate);

    if (pack) {
      return pack;
    }
  }

  return null;
}

export function knowledgeDraftAcceptedSourceLabel(
  pack: KnowledgeDraftReviewPack,
  item: KnowledgeDraftReviewItem,
) {
  return item.sourceLabel || pack.sourceLabel;
}

export function knowledgeDraftAcceptedSourceRef(
  pack: KnowledgeDraftReviewPack,
  item: KnowledgeDraftReviewItem,
) {
  return item.sourceRef || pack.queueItemId || pack.draftPackId;
}

export function knowledgeDraftAcceptedSourceRefs(
  pack: KnowledgeDraftReviewPack,
  item: KnowledgeDraftReviewItem,
): KnowledgeSourceRef[] {
  if (item.sourceRefs.length > 0) {
    return item.sourceRefs;
  }

  if (pack.sourceRefs.length > 0) {
    return pack.sourceRefs;
  }

  const queueTaskId = item.sourceQueueItemId ?? pack.queueItemId;
  if (queueTaskId) {
    return [
      {
        cap: "Bounded Queue draft pack review only",
        caps: ["Bounded Queue draft pack review only"],
        kind: "queue_task",
        label: knowledgeDraftAcceptedSourceLabel(pack, item),
        queueTaskId,
        reason: "Accepted from an operator-reviewed Knowledge draft pack.",
        warnings: ["Partial provenance fallback; draft item did not include structured sourceRefs."],
        workspaceScope: "workspace-local",
      },
    ];
  }

  return [
    {
      cap: "Imported or manual draft pack fallback",
      caps: ["Imported or manual draft pack fallback"],
      kind: "manual",
      label: knowledgeDraftAcceptedSourceLabel(pack, item),
      reason: "Accepted from an operator-reviewed draft pack without structured sourceRefs.",
      refText: knowledgeDraftAcceptedSourceRef(pack, item),
      warnings: ["Partial provenance fallback; sourceRefs were not available."],
      workspaceScope: "workspace-local",
    },
  ];
}

export function knowledgeDraftReviewSourceFingerprint(
  pack: KnowledgeDraftReviewPack,
) {
  return [
    pack.queueItemId ? `queue:${pack.queueItemId}` : null,
    `pack:${pack.draftPackId}`,
    pack.sourceLabel ? `source:${pack.sourceLabel}` : null,
  ]
    .filter(Boolean)
    .join("|");
}

export function knowledgeDraftReviewItemKey(
  pack: KnowledgeDraftReviewPack,
  item: KnowledgeDraftReviewItem,
) {
  return [
    pack.draftPackId,
    item.draftItemId,
    item.sourceRef || item.title,
  ]
    .filter(Boolean)
    .join("|");
}

function candidateValuesFromText(text: string) {
  const trimmed = text.trim();
  const candidates: unknown[] = [];

  if (!trimmed) {
    return candidates;
  }

  addParsedJson(trimmed, candidates);

  const fencedBlockPattern = /```(?:json|hobit-knowledge-draft)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fencedBlockPattern)) {
    addParsedJson(match[1]?.trim() ?? "", candidates);
  }

  for (const jsonText of balancedJsonObjects(trimmed)) {
    addParsedJson(jsonText, candidates);
  }

  return candidates;
}

function addParsedJson(text: string, candidates: unknown[]) {
  if (!text) {
    return;
  }

  try {
    candidates.push(JSON.parse(text));
  } catch {
    // Non-JSON report text is expected. The caller tries other bounded shapes.
  }
}

function balancedJsonObjects(text: string) {
  const values: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        values.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return values;
}

function findDraftPack(value: unknown, depth = 0): KnowledgeDraftReviewPack | null {
  if (!isRecord(value) || depth > 6) {
    return null;
  }

  const direct = normalizeDraftPack(value);
  if (direct) {
    return direct;
  }

  const knownNestedKeys = [
    "draftKnowledgePack",
    "draft_knowledge_pack",
    "knowledgeDraftPack",
    "knowledge_draft_pack",
    "draftPack",
    "draft_pack",
    "structuredOutput",
    "structured_output",
    "report",
    "result",
  ];

  for (const key of knownNestedKeys) {
    const nested = findDraftPack(value[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findDraftPack(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeDraftPack(value: Record<string, unknown>) {
  const proposedItemsValue =
    value.proposedItems ?? value.proposed_items ?? value.draftItems ?? value.items;

  if (!Array.isArray(proposedItemsValue)) {
    return null;
  }

  const queueItemId = stringValue(
    value.queueItemId ??
      value.queue_item_id ??
      value.queueTaskId ??
      value.queue_task_id ??
      value.sourceQueueTaskId ??
      value.source_queue_task_id,
  );
  const draftPackId =
    stringValue(value.draftPackId ?? value.draft_pack_id ?? value.packId) ||
    queueItemId ||
    "imported-draft-pack";
  const packTitle =
    stringValue(value.packTitle ?? value.pack_title ?? value.title) ||
    "Knowledge draft pack";
  const generationGoal = stringValue(value.generationGoal ?? value.generation_goal);
  const sourceLabel = queueItemId
    ? `Queue task ${queueItemId}`
    : "Imported draft pack";
  const packSourceRefs = normalizeSourceRefs(value.sourceRefs ?? value.source_refs);
  const proposedItems = proposedItemsValue
    .map((item, index) =>
      normalizeDraftItem(item, {
        fallbackId: `draft-item-${index + 1}`,
        fallbackSourceLabel: sourceLabel,
        fallbackSourceRefs: packSourceRefs,
        queueItemId,
      }),
    )
    .filter((item): item is KnowledgeDraftReviewItem => Boolean(item));

  if (proposedItems.length === 0) {
    return null;
  }

  return {
    draftPackId,
    generationGoal,
    packTitle,
    proposedItems,
    queueItemId,
    rawJson: JSON.stringify(value, null, 2),
    sourceLabel,
    sourceRefs: packSourceRefs,
  };
}

function normalizeDraftItem(
  value: unknown,
  options: {
    fallbackId: string;
    fallbackSourceLabel: string;
    fallbackSourceRefs: KnowledgeSourceRef[];
    queueItemId: string | null;
  },
): KnowledgeDraftReviewItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = stringValue(value.title ?? value.name);
  const fullContent = stringValue(
    value.fullContent ??
      value.full_content ??
      value.content ??
      value.body ??
      value.text,
  );
  const quickSummary = stringValue(
    value.quickSummary ?? value.quick_summary ?? value.summary,
  );

  if (!title || (!fullContent && !quickSummary)) {
    return null;
  }

  const suggestedType = normalizeKnowledgeType(
    stringValue(value.suggestedType ?? value.suggested_type ?? value.type),
  );
  const targetKind = suggestedType === "skill" ? "skill" : "document";
  const draftItemId =
    stringValue(value.draftItemId ?? value.draft_item_id ?? value.itemId) ||
    options.fallbackId;
  const itemQueueId = stringValue(value.queueItemId ?? value.queue_item_id);
  const sourceQueueItemId = itemQueueId || options.queueItemId;
  const sourceRef =
    stringValue(value.sourceRef ?? value.source_ref) ||
    [sourceQueueItemId ? `queue:${sourceQueueItemId}` : null, `draft:${draftItemId}`]
      .filter(Boolean)
      .join(";");
  const itemSourceRefs = normalizeSourceRefs(value.sourceRefs ?? value.source_refs);
  const sourceRefs =
    itemSourceRefs.length > 0 ? itemSourceRefs : options.fallbackSourceRefs;

  return {
    activationRecommendation: stringValue(
      value.activationRecommendation ?? value.activation_recommendation,
    ),
    blockers: listText(value.blockers),
    confidence: stringValue(value.confidence),
    draftItemId,
    fullContent: fullContent || quickSummary,
    quickSummary,
    relatedTasks: stringList(value.relatedTasks ?? value.related_tasks),
    reviewNotes: stringValue(value.reviewNotes ?? value.review_notes),
    sourceLabel:
      stringValue(value.sourceLabel ?? value.source_label) ||
      options.fallbackSourceLabel,
    sourceQueueItemId,
    sourceRef,
    sourceRefs,
    suggestedScope: normalizeScope(
      stringValue(value.suggestedScope ?? value.suggested_scope ?? value.scope),
    ),
    suggestedTags: listText(value.suggestedTags ?? value.suggested_tags ?? value.tags),
    suggestedType,
    targetKind,
    title,
  };
}

function normalizeSourceRefs(value: unknown): KnowledgeSourceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeSourceRef)
    .filter((sourceRef): sourceRef is KnowledgeSourceRef => Boolean(sourceRef));
}

function normalizeSourceRef(value: unknown): KnowledgeSourceRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = stringValue(value.kind);
  const label = stringValue(value.label) || "Draft source";
  const metadata = {
    cap: stringValue(value.cap) || null,
    caps: stringList(value.caps),
    reason: stringValue(value.reason) || null,
    warnings: stringList(value.warnings),
    workspaceScope: normalizeSourceScope(
      stringValue(value.workspaceScope ?? value.workspace_scope ?? value.scope),
    ),
  };

  switch (kind) {
    case "codebase":
    case "codebase_path":
      return {
        ...metadata,
        kind: "codebase_path",
        label,
        path: stringValue(value.path ?? value.selector ?? value.id),
        selector: stringValue(value.selector) || null,
      };
    case "docs":
    case "docs_path":
      return {
        ...metadata,
        kind: "docs_path",
        label,
        path: stringValue(value.path ?? value.selector ?? value.id),
        selector: stringValue(value.selector) || null,
      };
    case "queue_task":
      return {
        ...metadata,
        kind: "queue_task",
        label,
        queueTaskId: stringValue(value.queueTaskId ?? value.queue_task_id ?? value.id),
      };
    case "queue_run":
      return {
        ...metadata,
        kind: "queue_run",
        label,
        queueTaskId:
          stringValue(value.queueTaskId ?? value.queue_task_id) || null,
        runId: stringValue(value.runId ?? value.run_id ?? value.id),
      };
    case "note":
      return {
        ...metadata,
        kind: "note",
        label,
        noteId: stringValue(value.noteId ?? value.note_id ?? value.id),
      };
    case "finder_selection":
      return {
        ...metadata,
        kind: "finder_selection",
        label,
        path: stringValue(value.path ?? value.selector ?? value.id),
        selectionId:
          stringValue(value.selectionId ?? value.selection_id) || null,
        selectionKind:
          stringValue(value.selectionKind ?? value.selection_kind) || null,
      };
    case "import_file":
      return {
        ...metadata,
        fileName: stringValue(value.fileName ?? value.file_name) || null,
        kind: "import_file",
        label,
        path: stringValue(value.path ?? value.selector ?? value.id),
      };
    case "coordinator_history":
    case "command_history":
    case "manual":
      return {
        ...metadata,
        kind: "manual",
        label,
        refText: stringValue(value.refText ?? value.ref_text ?? value.selector ?? value.id),
      };
    default:
      return null;
  }
}

function normalizeSourceScope(
  value: string,
): KnowledgeScope | "current-session-visible" | null {
  if (
    value === "workspace-local" ||
    value === "global" ||
    value === "current-session-visible"
  ) {
    return value;
  }

  return null;
}

function normalizeKnowledgeType(value: string): KnowledgeCatalogItemType {
  const normalized = value.trim();

  return KNOWLEDGE_DOCUMENT_TYPES.includes(normalized as KnowledgeCatalogItemType)
    ? (normalized as KnowledgeCatalogItemType)
    : "documentation_knowledge";
}

function normalizeScope(value: string): KnowledgeDocumentScope {
  const normalized = value.trim().toLowerCase();

  return normalized === "global" || normalized === "local-global"
    ? "global"
    : "workspace";
}

function listText(value: unknown) {
  return stringList(value).join(", ");
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stringValue(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const text = stringValue(value);
  return text ? [text] : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
