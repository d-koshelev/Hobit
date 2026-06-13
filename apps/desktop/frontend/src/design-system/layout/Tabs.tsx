import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
} from "react";

type TabItem<T extends string> = {
  readonly disabled?: boolean;
  readonly id: T;
  readonly label: ReactNode;
  readonly panel: ReactNode;
};

type TabsProps<T extends string> = {
  readonly className?: string;
  readonly items: readonly TabItem<T>[];
  readonly selected: T;
  readonly onSelectedChange: (selected: T) => void;
};

export function Tabs<T extends string>({
  className,
  items,
  selected,
  onSelectedChange,
}: TabsProps<T>) {
  const tabsId = useId();
  const active = items.find((item) => item.id === selected) ?? items[0];
  const safeActive = active?.id ?? selected;

  const focusableItems = useMemo(
    () => items.filter((item) => !item.disabled),
    [items],
  );

  const onTabSelect = useCallback(
    (itemId: T) => {
      if (itemId !== safeActive) {
        onSelectedChange(itemId);
      }
    },
    [safeActive, onSelectedChange],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!focusableItems.length) {
        return;
      }

      if (
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      const currentIndex = focusableItems.findIndex(
        (item) => item.id === safeActive,
      );
      if (currentIndex === -1) {
        return;
      }

      const nextIndex = getNextTabIndex(
        event.key,
        currentIndex,
        focusableItems.length,
      );
      const nextItem = focusableItems[nextIndex];

      onTabSelect(nextItem.id);

      requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(
            `#${tabsId}-tab-${sanitizeTabId(nextItem.id)}`,
          )
          ?.focus();
      });
    },
    [focusableItems, onTabSelect, safeActive, tabsId],
  );

  if (!active) {
    return null;
  }

  return (
    <section className={["ui-tabs", className].filter(Boolean).join(" ")}>
      <div
        aria-orientation="horizontal"
        className="ui-tab-list"
        onKeyDown={onKeyDown}
        role="tablist"
      >
        {items.map((item) => {
          const isSelected = safeActive === item.id;
          const panelId = `${tabsId}-panel-${sanitizeTabId(item.id)}`;
          const tabId = `${tabsId}-tab-${sanitizeTabId(item.id)}`;

          return (
            <button
              aria-controls={panelId}
              aria-disabled={item.disabled}
              aria-selected={isSelected}
              className="ui-tab-button"
              disabled={item.disabled}
              id={tabId}
              key={item.id}
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                onTabSelect(item.id);
              }}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${tabsId}-tab-${sanitizeTabId(safeActive)}`}
        className="ui-tab-panel"
        id={`${tabsId}-panel-${sanitizeTabId(safeActive)}`}
        role="tabpanel"
      >
        {active.panel}
      </div>
    </section>
  );
}

function getNextTabIndex(
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
  current: number,
  total: number,
) {
  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return total - 1;
  }

  if (key === "ArrowRight") {
    return (current + 1) % total;
  }

  return (current - 1 + total) % total;
}

function sanitizeTabId(id: string): string {
  return String(id).replace(/\W+/g, "-");
}

