import { Button } from "../../../design-system/Button";
import type {
  KnowledgeV2ActionAvailability,
  KnowledgeV2ActionAvailabilityMap,
  KnowledgeV2ActionKind,
} from "./KnowledgeV2Actions";

type KnowledgeV2ActionFooterProps = {
  readonly action: KnowledgeV2ActionKind;
  readonly availability: KnowledgeV2ActionAvailabilityMap;
  readonly onDraftReview?: () => void;
  readonly onImport?: () => void;
  readonly onManageSkills?: () => void;
  readonly onNew?: () => void;
};

export function KnowledgeV2ActionFooter({
  action,
  availability,
  onDraftReview,
  onImport,
  onManageSkills,
  onNew,
}: KnowledgeV2ActionFooterProps) {
  switch (action) {
    case "new-knowledge":
      return (
        <ActionFooterButton
          availability={availability.newKnowledge}
          label="Open existing create flow"
          onClick={onNew}
        />
      );
    case "import-file":
      return (
        <ActionFooterButton
          availability={availability.importFile}
          label="Open existing import flow"
          onClick={onImport}
        />
      );
    case "draft-review":
      return (
        <ActionFooterButton
          availability={availability.draftReview}
          label="Open existing draft review flow"
          onClick={onDraftReview}
        />
      );
    case "manage-skills":
      return (
        <ActionFooterButton
          availability={availability.manageSkills}
          label="Open existing skills flow"
          onClick={onManageSkills}
        />
      );
  }
}

function ActionFooterButton({
  availability,
  label,
  onClick,
}: {
  readonly availability: KnowledgeV2ActionAvailability;
  readonly label: string;
  readonly onClick?: () => void;
}) {
  if (availability.state !== "unavailable" && onClick) {
    return (
      <Button onClick={onClick} variant="secondary">
        {label}
      </Button>
    );
  }

  const reason = availability.reason ?? `${label} is unavailable in Knowledge.`;

  return (
    <div className="knowledge-v2-action-status">
      <Button disabled={true} title={reason} variant="secondary">
        {label}
      </Button>
      <span
        className="knowledge-v2-chip"
        data-tone={availability.state === "partial" ? "warning" : "unavailable"}
        title={reason}
      >
        {availability.state === "partial" ? "Partial" : "Unavailable"}
      </span>
    </div>
  );
}
