import type { ReactNode } from "react";
import { Tabs } from "../../../../../design-system";
import type { QueueV2DetailsTab } from "../../queueV2TaskDetailsActions";

export function QueueV2TaskDetailsTabs({
  activeTab,
  activityPanel,
  contextPanel,
  onTabChange,
  overviewPanel,
  promptPanel,
  resultPanel,
}: {
  activeTab: QueueV2DetailsTab;
  activityPanel: ReactNode;
  contextPanel: ReactNode;
  onTabChange: (tab: QueueV2DetailsTab) => void;
  overviewPanel: ReactNode;
  promptPanel: ReactNode;
  resultPanel: ReactNode;
}) {
  return (
    <>
      <Tabs
        className="queue-v2-task-details-tabs"
        items={[
          { id: "overview", label: "Overview", panel: overviewPanel },
          { id: "prompt", label: "Prompt", panel: promptPanel },
          { id: "context", label: "Context", panel: contextPanel },
          { id: "result", label: "Result", panel: resultPanel },
          { id: "activity", label: "Activity", panel: activityPanel },
        ]}
        onSelectedChange={onTabChange}
        selected={activeTab}
      />
      <div className="queue-v2-task-details-tab-aliases">
        <button onClick={() => onTabChange("activity")} type="button">
          Agent Log
        </button>
        <button onClick={() => onTabChange("result")} type="button">
          Files / Validation
        </button>
        <button onClick={() => onTabChange("result")} type="button">
          Coordinator
        </button>
      </div>
    </>
  );
}
