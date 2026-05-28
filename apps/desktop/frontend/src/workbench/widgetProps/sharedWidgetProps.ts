import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type SharedWidgetPropActions = Pick<
  WorkbenchWidgetInstanceActions,
  "listWidgetLogs" | "updateWidgetLayout" | "updateWidgetState"
>;

export function sharedWidgetProps(
  actions: SharedWidgetPropActions,
): Partial<WidgetRenderProps> {
  return {
    onLoadLogs: actions.listWidgetLogs,
    onUpdateLayout: actions.updateWidgetLayout,
    onUpdateState: actions.updateWidgetState,
  };
}
