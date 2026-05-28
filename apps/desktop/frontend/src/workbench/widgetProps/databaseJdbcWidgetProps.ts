import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type DatabaseJdbcActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createJdbcConnector"
  | "executeJdbcReadOnlyQuery"
  | "getJdbcConnector"
  | "listJdbcConnectors"
  | "updateJdbcConnector"
  | "validateJdbcReadOnlySql"
>;

export function databaseJdbcWidgetProps(
  actions: DatabaseJdbcActions,
): Partial<WidgetRenderProps> {
  return {
    onCreateJdbcConnector: actions.createJdbcConnector,
    onExecuteJdbcReadOnlyQuery: actions.executeJdbcReadOnlyQuery,
    onGetJdbcConnector: actions.getJdbcConnector,
    onListJdbcConnectors: actions.listJdbcConnectors,
    onUpdateJdbcConnector: actions.updateJdbcConnector,
    onValidateJdbcReadOnlySql: actions.validateJdbcReadOnlySql,
  };
}
