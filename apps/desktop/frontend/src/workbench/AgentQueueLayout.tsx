import type { ReactNode } from "react";

type AgentQueueLayoutProps = {
  detailsPanel: ReactNode;
  taskList: ReactNode;
};

export function AgentQueueLayout({
  detailsPanel,
  taskList,
}: AgentQueueLayoutProps) {
  return (
    <div className="agent-queue-product-layout">
      {taskList}
      {detailsPanel}
    </div>
  );
}
