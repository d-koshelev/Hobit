import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import type {
  WidgetDefinition,
  WidgetDefinitionId,
  WidgetInstance,
  WidgetInstanceId,
  WidgetLogEntry,
} from "./types";

export type WidgetRuntimeIdentity = {
  componentKey?: string;
  widgetDefinitionId?: WidgetDefinitionId;
  widgetInstanceId?: WidgetInstanceId;
  workspaceId?: string;
};

export type WidgetRuntimeLogsApi = {
  isAvailable: boolean;
  load: () => Promise<WidgetLogEntry[]>;
  refreshToken: number;
};

export type WidgetRuntimeContextValue = {
  identity: WidgetRuntimeIdentity;
  logs: WidgetRuntimeLogsApi;
};

type CreateWidgetRuntimeContextOptions = {
  definition?: WidgetDefinition | null;
  instance?: WidgetInstance | null;
  logs?: {
    load?: () => Promise<WidgetLogEntry[]>;
    refreshToken?: number;
  };
  workspaceId?: string;
};

const defaultLoadLogs = async () => [];

export const defaultWidgetRuntimeContext: WidgetRuntimeContextValue = {
  identity: {},
  logs: {
    isAvailable: false,
    load: defaultLoadLogs,
    refreshToken: 0,
  },
};

const WidgetRuntimeContext = createContext<WidgetRuntimeContextValue>(
  defaultWidgetRuntimeContext,
);

export function createWidgetRuntimeContext({
  definition,
  instance,
  logs,
  workspaceId,
}: CreateWidgetRuntimeContextOptions = {}): WidgetRuntimeContextValue {
  const loadLogs = logs?.load ?? defaultLoadLogs;

  return {
    identity: {
      componentKey: definition?.componentKey,
      widgetDefinitionId: definition?.id ?? instance?.definitionId,
      widgetInstanceId: instance?.id,
      workspaceId,
    },
    logs: {
      isAvailable: Boolean(logs?.load),
      load: loadLogs,
      refreshToken: logs?.refreshToken ?? 0,
    },
  };
}

export function WidgetRuntimeContextProvider({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime: WidgetRuntimeContextValue;
}) {
  const value = useMemo(() => runtime, [runtime]);

  return (
    <WidgetRuntimeContext.Provider value={value}>
      {children}
    </WidgetRuntimeContext.Provider>
  );
}

export function useWidgetRuntimeContext() {
  return useContext(WidgetRuntimeContext);
}
