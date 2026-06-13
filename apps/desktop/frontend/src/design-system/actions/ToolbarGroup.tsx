import { TopbarGroup } from "../ActionPrimitives";

type ToolbarGroupProps = Parameters<typeof TopbarGroup>[0];

export function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return (
    <TopbarGroup
      className={["ui-toolbar-group", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

