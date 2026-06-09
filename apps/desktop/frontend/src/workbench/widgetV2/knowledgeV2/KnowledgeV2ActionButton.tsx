import type { RefObject } from "react";

import { Button } from "../../../design-system/Button";
import type { KnowledgeV2ActionKind } from "./KnowledgeV2Actions";

type KnowledgeV2ActionButtonProps = {
  readonly badge: string | null;
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
  readonly kind: KnowledgeV2ActionKind;
  readonly label: string;
  readonly onOpen: () => void;
  readonly role?: "menuitem";
  readonly variant?: "primary" | "secondary";
};

export function KnowledgeV2ActionButton({
  badge,
  buttonRef,
  kind,
  label,
  onOpen,
  role,
  variant,
}: KnowledgeV2ActionButtonProps) {
  return (
    <Button
      onClick={onOpen}
      ref={buttonRef}
      role={role}
      variant={variant ?? (kind === "new-knowledge" ? "primary" : "secondary")}
    >
      {label}
      {badge ? <span className="knowledge-v2-action-badge">{badge}</span> : null}
    </Button>
  );
}
