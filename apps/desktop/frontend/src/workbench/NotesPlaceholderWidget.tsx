import { Badge } from "../design-system/Badge";
import { EmptyState } from "../design-system/EmptyState";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

export function NotesPlaceholderWidget({ title }: WidgetRenderProps) {
  return (
    <WidgetFrame
      status={<Badge variant="neutral">Placeholder</Badge>}
      subtitle="Notes widget placeholder"
      title={title}
    >
      <EmptyState
        text="Notes editing is planned. In desktop mode this placeholder is saved with the Workbench."
        title="Notes placeholder"
      />
    </WidgetFrame>
  );
}
