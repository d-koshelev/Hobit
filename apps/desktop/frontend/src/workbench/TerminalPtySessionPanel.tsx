import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../design-system/Button";
import { TerminalPtyPanePanel } from "./TerminalPtyPanePanel";
import type { TerminalPtySessionPanelProps } from "./TerminalPtySessionTypes";
import type { TerminalFrameStatusView } from "./TerminalRunCommandPanel";

const MAX_PANES_PER_TAB = 4;
const INITIAL_TAB_ID = "terminal-tab-1";
const INITIAL_PANE_ID = "terminal-pane-1";

type TerminalTab = {
  activePaneId: string;
  id: string;
  layoutMode: "columns" | "grid" | "rows";
  paneIds: string[];
  title: string;
};

export function TerminalPtySessionPanel({
  instance,
  onActiveSessionChange,
  onFrameStatusChange,
  ...paneCallbacks
}: TerminalPtySessionPanelProps) {
  const nextTabNumberRef = useRef(2);
  const nextPaneNumberRef = useRef(2);
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      activePaneId: INITIAL_PANE_ID,
      id: INITIAL_TAB_ID,
      layoutMode: "columns",
      paneIds: [INITIAL_PANE_ID],
      title: "Tab 1",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB_ID);
  const [paneActivity, setPaneActivity] = useState<Record<string, boolean>>({});
  const [paneStatuses, setPaneStatuses] = useState<
    Record<string, TerminalFrameStatusView>
  >({});

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activePaneStatus = activeTab
    ? paneStatuses[activeTab.activePaneId]
    : null;

  useEffect(() => {
    if (activePaneStatus) {
      onFrameStatusChange?.(activePaneStatus);
    }
  }, [activePaneStatus, onFrameStatusChange]);

  useEffect(() => {
    onActiveSessionChange?.(
      Object.values(paneActivity).some((isActive) => isActive),
    );
  }, [onActiveSessionChange, paneActivity]);

  const recordPaneActivity = useCallback(
    (paneId: string, isActive: boolean) => {
      setPaneActivity((current) =>
        current[paneId] === isActive
          ? current
          : { ...current, [paneId]: isActive },
      );
    },
    [],
  );

  const recordPaneStatus = useCallback(
    (paneId: string, status: TerminalFrameStatusView) => {
      setPaneStatuses((current) =>
        current[paneId]?.label === status.label &&
        current[paneId]?.variant === status.variant
          ? current
          : { ...current, [paneId]: status },
      );
    },
    [],
  );

  function createTab() {
    const tabNumber = nextTabNumberRef.current;
    nextTabNumberRef.current += 1;
    const paneId = createPaneId(nextPaneNumberRef);
    const tabId = `terminal-tab-${tabNumber}`;

    setTabs((current) => [
      ...current,
      {
        activePaneId: paneId,
        id: tabId,
        layoutMode: "columns",
        paneIds: [paneId],
        title: `Tab ${tabNumber}`,
      },
    ]);
    setActiveTabId(tabId);
  }

  function renameTab(tabId: string, title: string) {
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)),
    );
  }

  function commitTabRename(tabId: string) {
    setTabs((current) =>
      current.map((tab) =>
        tab.id === tabId && !tab.title.trim()
          ? { ...tab, title: "Untitled" }
          : tab,
      ),
    );
  }

  function closeTab(tabId: string) {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    if (
      !tab ||
      tabs.length === 1 ||
      tab.paneIds.some((paneId) => paneActivity[paneId])
    ) {
      return;
    }

    setTabs((current) => {
      const nextTabs = current.filter((candidate) => candidate.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[0]?.id ?? INITIAL_TAB_ID);
      }
      return nextTabs;
    });
  }

  function activatePane(tabId: string, paneId: string) {
    setActiveTabId(tabId);
    setTabs((current) =>
      current.map((tab) =>
        tab.id === tabId ? { ...tab, activePaneId: paneId } : tab,
      ),
    );
  }

  function splitActivePane(direction: "columns" | "rows") {
    if (!activeTab || activeTab.paneIds.length >= MAX_PANES_PER_TAB) {
      return;
    }

    const newPaneId = createPaneId(nextPaneNumberRef);
    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTab.id) {
          return tab;
        }

        const nextLayoutMode =
          tab.paneIds.length > 1 && tab.layoutMode !== direction
            ? "grid"
            : direction;

        return {
          ...tab,
          activePaneId: newPaneId,
          layoutMode: nextLayoutMode,
          paneIds: [...tab.paneIds, newPaneId],
        };
      }),
    );
  }

  function closePane(tabId: string, paneId: string) {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    if (!tab || tab.paneIds.length === 1 || paneActivity[paneId]) {
      return;
    }

    const remainingPaneIds = tab.paneIds.filter((id) => id !== paneId);
    setTabs((current) =>
      current.map((candidate) =>
        candidate.id === tabId
          ? {
              ...candidate,
              activePaneId:
                candidate.activePaneId === paneId
                  ? remainingPaneIds[0]
                  : candidate.activePaneId,
              layoutMode:
                remainingPaneIds.length === 1 ? "columns" : candidate.layoutMode,
              paneIds: remainingPaneIds,
            }
          : candidate,
      ),
    );
    setPaneActivity((current) => omitKey(current, paneId));
    setPaneStatuses((current) => omitKey(current, paneId));
  }

  return (
    <section aria-label="Terminal session" className="terminal-pty-panel">
      <div className="terminal-tabs">
        <div
          className="terminal-tab-list"
          role="tablist"
          aria-label="Terminal tabs"
        >
          {tabs.map((tab) => {
            const tabActive = tab.id === activeTabId;
            const tabRunning = tab.paneIds.some((paneId) => paneActivity[paneId]);
            const closeDisabled = tabs.length === 1 || tabRunning;
            const displayTitle = tab.title.trim() || "Untitled";
            return (
              <span
                className={
                  tabActive
                    ? "terminal-tab terminal-tab-active"
                    : "terminal-tab"
                }
                key={tab.id}
                role="tab"
                aria-selected={tabActive}
              >
                <input
                  aria-label={`Rename ${displayTitle}`}
                  className="terminal-tab-name-input"
                  onBlur={() => commitTabRename(tab.id)}
                  onChange={(event) => renameTab(tab.id, event.target.value)}
                  onFocus={() => setActiveTabId(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  spellCheck={false}
                  title={displayTitle}
                  type="text"
                  value={tab.title}
                />
                <button
                  aria-label={`Close ${displayTitle}`}
                  className="terminal-tab-close"
                  disabled={closeDisabled}
                  onClick={() => closeTab(tab.id)}
                  title={
                    tabRunning
                      ? "Stop or kill running panes before closing this tab."
                      : undefined
                  }
                  type="button"
                >
                  x
                </button>
              </span>
            );
          })}
        </div>
        <Button
          aria-label="New terminal tab"
          className="terminal-tab-new"
          onClick={createTab}
          title="New tab"
          variant="secondary"
        >
          + Tab
        </Button>
      </div>

      {tabs.map((tab) => (
        <div
          aria-hidden={tab.id !== activeTabId}
          className={
            tab.id === activeTabId
              ? "terminal-tab-panel terminal-tab-panel-active"
              : "terminal-tab-panel"
          }
          key={tab.id}
          role="tabpanel"
        >
          <div
            className={`terminal-pane-grid terminal-pane-grid-${tab.layoutMode}`}
          >
            {tab.paneIds.map((paneId, paneIndex) => (
              <TerminalPtyPanePanel
                {...paneCallbacks}
                canClosePane={tab.paneIds.length > 1}
                canSplitPane={tab.paneIds.length < MAX_PANES_PER_TAB}
                instance={instance}
                isActivePane={paneId === tab.activePaneId}
                isTabVisible={tab.id === activeTabId}
                key={paneId}
                onActivatePane={() => activatePane(tab.id, paneId)}
                onClosePane={() => closePane(tab.id, paneId)}
                onPaneActiveSessionChange={(isActive) =>
                  recordPaneActivity(paneId, isActive)
                }
                onPaneStatusChange={(status) => recordPaneStatus(paneId, status)}
                onSplitDown={() => splitActivePane("rows")}
                onSplitRight={() => splitActivePane("columns")}
                paneId={paneId}
                paneLabel={`Pane ${paneIndex + 1}`}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function createPaneId(nextPaneNumberRef: { current: number }) {
  const paneNumber = nextPaneNumberRef.current;
  nextPaneNumberRef.current += 1;
  return `terminal-pane-${paneNumber}`;
}

function omitKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}
