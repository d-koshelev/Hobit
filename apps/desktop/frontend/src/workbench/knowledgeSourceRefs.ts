import type {
  KnowledgeScope,
  KnowledgeSourceRef,
} from "../workspace/types";

export type KnowledgeGenerationSourceRefKind =
  | "codebase"
  | "docs"
  | "coordinator_history"
  | "command_history";

export type KnowledgeGenerationSourceRef = {
  caps: string[];
  id?: string;
  kind: KnowledgeGenerationSourceRefKind;
  label: string;
  path?: string;
  reason: string;
  scope: KnowledgeScope | "current-session-visible";
  selector?: string;
  warnings: string[];
};

export const SOURCE_REF_PROMPT_FALLBACK_WARNING =
  "Current Queue task API has no durable sourceRefs field; these structured refs are embedded in the prompt only.";

export function formatKnowledgeGenerationSourceRefs(
  refs: KnowledgeGenerationSourceRef[],
) {
  return [
    "Structured source refs:",
    "Fallback: if task metadata has no sourceRefs field, use this typed prompt payload as the sourceRefs helper object.",
    ...refs.flatMap((ref, index) => [
      `${index + 1}. kind: ${ref.kind}`,
      `   label: ${ref.label}`,
      ...(ref.selector ? [`   selector: ${ref.selector}`] : []),
      ...(ref.path ? [`   path: ${ref.path}`] : []),
      ...(ref.id ? [`   id: ${ref.id}`] : []),
      `   reason: ${ref.reason}`,
      `   scope: ${ref.scope}`,
      `   caps: ${ref.caps.join("; ")}`,
      `   warnings: ${ref.warnings.join("; ") || "none"}`,
    ]),
  ].join("\n");
}

export function knowledgeSourceRefsFromGenerationRefs(
  refs: KnowledgeGenerationSourceRef[],
): KnowledgeSourceRef[] {
  return refs.map(knowledgeSourceRefFromGenerationRef);
}

export function knowledgeSourceRefFromGenerationRef(
  ref: KnowledgeGenerationSourceRef,
): KnowledgeSourceRef {
  const metadata = {
    caps: ref.caps,
    reason: ref.reason,
    warnings: ref.warnings,
    workspaceScope: ref.scope,
  };

  if (ref.kind === "docs") {
    return {
      ...metadata,
      kind: "docs_path",
      label: ref.label,
      path: ref.path ?? ref.selector ?? ref.id ?? "",
      selector: ref.selector,
    };
  }

  if (ref.kind === "coordinator_history") {
    return {
      ...metadata,
      kind: "manual",
      label: ref.label,
      refText: ref.selector ?? ref.id ?? ref.path ?? "",
    };
  }

  if (ref.kind === "command_history") {
    const selector = ref.selector ?? ref.id ?? ref.path ?? "";
    if (selector.startsWith("queue:")) {
      return {
        ...metadata,
        kind: "queue_task",
        label: ref.label,
        queueTaskId: selector.slice("queue:".length),
      };
    }

    if (selector.startsWith("run:")) {
      return {
        ...metadata,
        kind: "queue_run",
        label: ref.label,
        runId: selector.slice("run:".length),
      };
    }

    return {
      ...metadata,
      kind: "manual",
      label: ref.label,
      refText: selector,
    };
  }

  return {
    ...metadata,
    kind: "codebase_path",
    label: ref.label,
    path: ref.path ?? ref.selector ?? ref.id ?? "",
    selector: ref.selector,
  };
}

export function sourceRefCapText(
  caps: string[],
  warnings: string[] = [],
) {
  return [
    caps.length > 0 ? `Caps: ${caps.join("; ")}` : "",
    warnings.length > 0 ? `Warnings: ${warnings.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
