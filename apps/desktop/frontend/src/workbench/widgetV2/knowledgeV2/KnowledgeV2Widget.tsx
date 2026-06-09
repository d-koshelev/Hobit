import {
  WidgetV2PanelLayout,
  WidgetV2RightInspector,
  WidgetV2Shell,
  WidgetV2Toolbar,
} from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import { KnowledgeV2Header } from "./KnowledgeV2Header";

const knowledgeV2Manifest = getWidgetV2Manifest("knowledge-v2");

type KnowledgeV2ActionName = "new" | "import" | "draftReview" | "manageSkills";

export type KnowledgeV2WidgetProps = {
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
};

const actionLabels: ReadonlyArray<{
  readonly action: KnowledgeV2ActionName;
  readonly label: string;
}> = [
  { action: "new", label: "New" },
  { action: "import", label: "Import" },
  { action: "draftReview", label: "Draft Review" },
  { action: "manageSkills", label: "Manage Skills" },
];

export function KnowledgeV2Widget(_props: KnowledgeV2WidgetProps = {}) {
  return (
    <WidgetV2Shell
      status={{
        detail:
          "KnowledgeV2 is an experimental frontend-only shell. Current Knowledge / Skills remains the production surface.",
        label: "Experimental",
        tone: "warning",
      }}
      subtitle="Preview scaffold only. No documents, Skills, Queue context, Workspace Agent context, indexing, storage, or import flow is read or changed here."
      title={knowledgeV2Manifest?.title ?? "Knowledge v2"}
    >
      <WidgetV2Toolbar label="Knowledge v2 search and action row">
        <div className="knowledge-v2-toolbar">
          <label className="knowledge-v2-search-field">
            <span>Search</span>
            <input
              aria-label="Knowledge v2 search placeholder"
              disabled
              placeholder="Search and filters are not wired yet"
              type="search"
            />
          </label>
          <select
            aria-label="Knowledge v2 item type filter placeholder"
            disabled
            value="all"
          >
            <option value="all">All items</option>
          </select>
          <select
            aria-label="Knowledge v2 scope filter placeholder"
            disabled
            value="all"
          >
            <option value="all">All scopes</option>
          </select>
          <div aria-label="Knowledge v2 placeholder actions" className="knowledge-v2-actions">
            {actionLabels.map((action) => (
              <button
                className="button button-secondary button-sm"
                disabled
                key={action.action}
                title={`${action.label} is a placeholder in the experimental KnowledgeV2 shell.`}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </WidgetV2Toolbar>
      <WidgetV2PanelLayout
        primary={<KnowledgeV2CatalogListPlaceholder />}
        primaryLabel="Knowledge v2 catalog list"
        rightInspector={
          <WidgetV2RightInspector label="Knowledge v2 preview details">
            <KnowledgeV2PreviewPlaceholder />
          </WidgetV2RightInspector>
        }
      />
    </WidgetV2Shell>
  );
}

function KnowledgeV2CatalogListPlaceholder() {
  return (
    <section aria-label="Knowledge v2 catalog placeholder" className="knowledge-v2-list">
      <KnowledgeV2Header />
      <div className="knowledge-v2-empty">
        <h3>Catalog list placeholder</h3>
        <p>
          Knowledge Documents and Skills will appear here in a later explicit data
          integration block.
        </p>
        <p>
          This shell does not read existing catalog records, search hidden context,
          import files, or create Queue tasks.
        </p>
      </div>
    </section>
  );
}

function KnowledgeV2PreviewPlaceholder() {
  return (
    <section
      aria-label="Knowledge v2 preview placeholder"
      className="knowledge-v2-preview"
    >
      <h3>Preview/details placeholder</h3>
      <p>
        Select a future catalog item to review summary, lifecycle, source, scope,
        and explicit action availability.
      </p>
      <p>
        Unsupported behavior remains unavailable in this experimental shell.
      </p>
    </section>
  );
}
