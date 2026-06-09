import type { KnowledgeDocument } from "../../../workspace/types/knowledgeDocuments";
import type { Skill } from "../../../workspace/types/skills";
import { WidgetV2Shell } from "../WidgetV2Shell";
import { getWidgetV2Manifest } from "../widgetV2Registry";
import { KnowledgeV2Actions } from "./KnowledgeV2Actions";
import { KnowledgeV2CatalogBrowser } from "./KnowledgeV2CatalogBrowser";

const knowledgeV2Manifest = getWidgetV2Manifest("knowledge-v2");

export type KnowledgeV2WidgetProps = {
  readonly documents?: readonly KnowledgeDocument[];
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
  readonly skills?: readonly Skill[];
};

export function KnowledgeV2Widget({
  documents = [],
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
  skills = [],
}: KnowledgeV2WidgetProps = {}) {
  return (
    <WidgetV2Shell
      actions={
        <KnowledgeV2Actions
          documents={documents}
          onDraftReview={onDraftReview}
          onImport={onImport}
          onManageSkills={onManageSkills}
          onNew={onNew}
          skills={skills}
        />
      }
      status={{
        detail:
          "KnowledgeV2 is an experimental frontend-only browser. Current Knowledge / Skills remains the production surface.",
        label: "Experimental",
        tone: "warning",
      }}
      subtitle="Browse and preview passed Knowledge Documents and Skills. Creation, import, draft review, indexing, storage, and backend behavior stay outside this surface."
      title={knowledgeV2Manifest?.title ?? "Knowledge v2"}
    >
      <KnowledgeV2CatalogBrowser documents={documents} skills={skills} />
    </WidgetV2Shell>
  );
}
