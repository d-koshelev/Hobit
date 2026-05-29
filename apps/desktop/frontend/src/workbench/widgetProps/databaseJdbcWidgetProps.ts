import type { WidgetRenderProps } from "../types";
import type { WorkbenchWidgetInstanceActions } from "../useWorkbenchWidgetActions";

type DatabaseJdbcActions = Pick<
  WorkbenchWidgetInstanceActions,
  | "createJdbcConnector"
  | "createJdbcConnectionProfile"
  | "deleteJdbcConnectionProfile"
  | "checkJdbcSidecarHealth"
  | "executeJdbcReadOnlyQuery"
  | "getJdbcConnector"
  | "listJdbcConnectors"
  | "listJdbcConnectionProfiles"
  | "probeJdbcDriver"
  | "updateJdbcConnector"
  | "updateJdbcConnectionProfile"
  | "validateJdbcReadOnlySql"
>;

export function databaseJdbcWidgetProps(
  actions: DatabaseJdbcActions,
): Partial<WidgetRenderProps> {
  return {
    onCreateJdbcConnector: actions.createJdbcConnector,
    onCreateJdbcConnectionProfile: actions.createJdbcConnectionProfile,
    onDeleteJdbcConnectionProfile: actions.deleteJdbcConnectionProfile,
    onCheckJdbcSidecarHealth: actions.checkJdbcSidecarHealth,
    onExecuteJdbcReadOnlyQuery: actions.executeJdbcReadOnlyQuery,
    onGetJdbcConnector: actions.getJdbcConnector,
    onListJdbcConnectors: actions.listJdbcConnectors,
    onListJdbcConnectionProfiles: actions.listJdbcConnectionProfiles,
    onProbeJdbcDriver: actions.probeJdbcDriver,
    onUpdateJdbcConnector: actions.updateJdbcConnector,
    onUpdateJdbcConnectionProfile: actions.updateJdbcConnectionProfile,
    onValidateJdbcReadOnlySql: actions.validateJdbcReadOnlySql,
  };
}
