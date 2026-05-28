import type { AgentActivityEvent } from "../agentActivityModel";
import type { WidgetRenderProps } from "../types";

type AgentActivityWidgetPropsOptions = {
  agentActivityEvents: AgentActivityEvent[];
};

export function agentActivityWidgetProps({
  agentActivityEvents,
}: AgentActivityWidgetPropsOptions): Partial<WidgetRenderProps> {
  return {
    agentActivityEvents,
  };
}
