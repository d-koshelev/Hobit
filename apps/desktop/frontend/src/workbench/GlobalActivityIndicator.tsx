import { Badge } from "../design-system/Badge";
import { StatusDot } from "../design-system/StatusDot";

export type GlobalActivityStatusKind =
  | "idle"
  | "running"
  | "waiting_for_approval"
  | "attention";

export type GlobalActivityStatus = {
  assistiveText: string;
  detail: string;
  kind: GlobalActivityStatusKind;
  label: string;
};

type GlobalActivityIndicatorProps = {
  status: GlobalActivityStatus;
};

export function GlobalActivityIndicator({
  status,
}: GlobalActivityIndicatorProps) {
  const variant = globalActivityVariant(status.kind);

  return (
    <Badge
      aria-label={status.assistiveText}
      className="global-activity-indicator"
      variant={variant}
    >
      <StatusDot aria-hidden="true" variant={variant} />
      <span className="global-activity-label">{status.label}</span>
      <span aria-hidden="true" className="global-activity-separator">
        -
      </span>
      <span className="global-activity-detail">{status.detail}</span>
    </Badge>
  );
}

function globalActivityVariant(
  kind: GlobalActivityStatusKind,
): "neutral" | "info" | "warning" | "error" {
  switch (kind) {
    case "running":
      return "info";
    case "waiting_for_approval":
      return "warning";
    case "attention":
      return "error";
    case "idle":
      return "neutral";
  }
}
