import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type DatabaseJdbcActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createJdbcConnector"
  | "checkJdbcSidecarHealth"
  | "executeJdbcReadOnlyQuery"
  | "getJdbcConnector"
  | "listJdbcConnectors"
  | "probeJdbcDriver"
  | "updateJdbcConnector"
  | "validateJdbcReadOnlySql"
>;

export function databaseJdbcWidgetProps(
  actions: DatabaseJdbcActions,
): Partial<WidgetRenderProps> {
  return {
    onCreateJdbcConnector: actions.createJdbcConnector,
    onCheckJdbcSidecarHealth: actions.checkJdbcSidecarHealth,
    onExecuteJdbcReadOnlyQuery: actions.executeJdbcReadOnlyQuery,
    onGetJdbcConnector: actions.getJdbcConnector,
    onListJdbcConnectors: actions.listJdbcConnectors,
    onProbeJdbcDriver: actions.probeJdbcDriver,
    onUpdateJdbcConnector: actions.updateJdbcConnector,
    onValidateJdbcReadOnlySql: actions.validateJdbcReadOnlySql,
  };
}
