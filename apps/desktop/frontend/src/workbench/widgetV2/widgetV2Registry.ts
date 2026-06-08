import {
  assertUniqueWidgetV2Kinds,
  validateWidgetV2Manifest,
} from "./widgetV2Manifest";
import type {
  WidgetV2Kind,
  WidgetV2Manifest,
  WidgetV2ManifestStatus,
} from "./widgetV2Types";

export const widgetV2Manifests: readonly WidgetV2Manifest[] = [
  {
    kind: "queue-v2",
    name: "QueueV2",
    title: "Agent Queue",
    description:
      "Board-first Agent Queue implementation for promoted async work organization.",
    productRole:
      "Organize promoted tasks, assignment, review, dependencies, and visible next actions as the normal Agent Queue visual surface.",
    capabilities: [
      "render-primary-surface",
      "dispatch-typed-action",
      "show-status",
      "show-inspector",
      "show-activity",
    ],
    layoutKind: "operational",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "available",
    productOwnerDomain: "agent-queue",
    safetyBoundaries: [
      "No hidden scheduler or backend dispatch.",
      "No automatic task acceptance.",
      "No Git mutation or Terminal launch.",
    ],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "left-rail", "right-inspector", "bottom-drawer"],
    domainBoundary: "Queue-owned state and explicit typed actions only.",
    safeContextSummary: "Uses visible Queue state only.",
    runtimeLimitations: ["No durable worker runtime is granted by the manifest."],
    nonGoals: [
      "No separate Agent Queue widget id.",
      "No standalone Widget Catalog entry outside the saved Agent Queue identity.",
      "No hidden execution.",
      "No automatic Queue item dispatch.",
    ],
  },
  {
    kind: "knowledge-v2",
    name: "KnowledgeV2",
    title: "Knowledge V2",
    description: "Future catalog surface for explicit Knowledge review and upkeep.",
    productRole:
      "Maintain operator-authored or operator-approved knowledge with provenance and lifecycle review.",
    capabilities: [
      "render-primary-surface",
      "dispatch-typed-action",
      "show-status",
      "show-inspector",
    ],
    layoutKind: "operational",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "planned",
    productOwnerDomain: "knowledge",
    safetyBoundaries: [
      "No hidden memory.",
      "No automatic ingestion or folder watching.",
      "No embeddings, vector search, or automatic prompt injection.",
    ],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "left-rail", "right-inspector"],
    domainBoundary: "Knowledge-owned catalog state and explicit review actions.",
    safeContextSummary: "Only explicitly enabled and visible Knowledge may be used.",
    runtimeLimitations: ["No team/server knowledge runtime is granted."],
    nonGoals: ["No hidden ingestion.", "No automatic AI context injection."],
  },
  {
    kind: "workspace-agent-v2",
    name: "WorkspaceAgentV2",
    title: "Workspace Agent v2",
    description:
      "Experimental foreground conversation and proposal review surface scaffold.",
    productRole:
      "Support operator conversation, visible context review, provider responses, and explicit work promotion.",
    capabilities: [
      "read-visible-context",
      "render-primary-surface",
      "dispatch-typed-action",
      "show-status",
      "show-overlay",
    ],
    layoutKind: "operational",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "experimental",
    productOwnerDomain: "workspace-agent",
    safetyBoundaries: [
      "No hidden context access.",
      "No hidden widget reads or mutation.",
      "No provider tool execution.",
      "No automatic Queue creation.",
    ],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "right-inspector", "bottom-drawer", "overlay"],
    domainBoundary: "Workspace Agent-owned conversation state and safe proposal drafts.",
    safeContextSummary: "Visible current-session context only.",
    runtimeLimitations: [
      "No runtime provider capability is granted by the manifest.",
      "Not a normal production catalog item.",
    ],
    nonGoals: [
      "No replacement of the V1 interactive-agent compatibility surface.",
      "No Terminal control.",
      "No Git mutation.",
      "No JDBC execution.",
      "No Queue task creation.",
    ],
  },
  {
    kind: "terminal-v2",
    name: "TerminalV2",
    title: "Terminal V2",
    description: "Future manual shell surface with explicit operator control.",
    productRole:
      "Provide visible, bounded terminal sessions for explicit operator-selected shells and directories.",
    capabilities: [
      "render-primary-surface",
      "dispatch-typed-action",
      "show-status",
      "show-activity",
    ],
    layoutKind: "operational",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "planned",
    productOwnerDomain: "terminal",
    safetyBoundaries: [
      "No Script Runner behavior.",
      "No Workspace Agent or Queue-triggered execution.",
      "No hidden background command runner.",
      "No persistent transcript storage.",
    ],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "bottom-drawer"],
    domainBoundary: "Terminal-owned manual session state and explicit shell input.",
    safeContextSummary: "PTY output remains visible and bounded.",
    runtimeLimitations: ["No new PTY backend capability is granted by the manifest."],
    nonGoals: ["No hidden automation.", "No arbitrary background execution."],
  },
  {
    kind: "finder-v2",
    name: "FinderV2",
    title: "Finder V2",
    description: "Future explicit-root file navigation and bounded preview surface.",
    productRole:
      "Navigate approved roots, preview selected files, and perform explicit file operations where allowed.",
    capabilities: [
      "render-primary-surface",
      "dispatch-typed-action",
      "show-status",
      "show-inspector",
      "show-overlay",
    ],
    layoutKind: "operational",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "planned",
    productOwnerDomain: "finder",
    safetyBoundaries: [
      "No hidden workspace scanning.",
      "No broad automatic indexing.",
      "No hidden context ingestion.",
      "No Terminal launch or Queue creation.",
    ],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "left-rail", "right-inspector", "overlay"],
    domainBoundary: "Finder-owned approved-root navigation and explicit file actions.",
    safeContextSummary: "Reads only approved roots and visible selections.",
    runtimeLimitations: ["No filesystem permission is granted by the manifest."],
    nonGoals: ["No IDE replacement.", "No hidden file reads."],
  },
  {
    kind: "notes-v2",
    name: "NotesV2",
    title: "Notes V2",
    description: "Future source-text note and notebook surface.",
    productRole:
      "Capture and maintain workspace-local note source text with explicit operator edits.",
    capabilities: [
      "render-primary-surface",
      "dispatch-typed-action",
      "show-status",
    ],
    layoutKind: "minimal",
    supportedLayoutKinds: ["minimal", "operational"],
    status: "planned",
    productOwnerDomain: "notes",
    safetyBoundaries: [
      "No hidden AI-in-Notes behavior.",
      "No hidden note reads by Workspace Agent.",
      "No command execution or remote asset loading.",
    ],
    requiredPanelSlots: ["header", "primary"],
    optionalPanelSlots: ["toolbar", "right-inspector"],
    domainBoundary: "Notes-owned source text and explicit save actions.",
    safeContextSummary: "Notes content is not agent context unless explicitly approved later.",
    runtimeLimitations: ["No Notebook renderer or AI editing behavior is granted."],
    nonGoals: ["No hidden agent access.", "No Markdown execution."],
  },
];

assertUniqueWidgetV2Kinds(widgetV2Manifests);

export type WidgetV2Registry = ReadonlyMap<WidgetV2Kind, WidgetV2Manifest>;

export const widgetV2Registry: WidgetV2Registry = new Map(
  widgetV2Manifests.map((manifest) => [manifest.kind, manifest]),
);

export function getWidgetV2Manifest(
  kind: WidgetV2Kind,
): WidgetV2Manifest | undefined {
  return widgetV2Registry.get(kind);
}

export function getWidgetV2ManifestsByStatus(
  status: WidgetV2ManifestStatus,
): readonly WidgetV2Manifest[] {
  return widgetV2Manifests.filter((manifest) => manifest.status === status);
}

export function getAvailableWidgetV2Manifests(): readonly WidgetV2Manifest[] {
  return getWidgetV2ManifestsByStatus("available");
}

export function validateWidgetV2Registry(
  manifests: readonly WidgetV2Manifest[] = widgetV2Manifests,
) {
  const errors = manifests.flatMap((manifest) =>
    validateWidgetV2Manifest(manifest).errors.map(
      (error) => `${manifest.kind}: ${error}`,
    ),
  );

  try {
    assertUniqueWidgetV2Kinds(manifests);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
