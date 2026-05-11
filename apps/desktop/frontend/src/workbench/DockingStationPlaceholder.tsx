import { useState } from "react";

import { Badge } from "../design-system/Badge";

type DockingStationRail = "top" | "right" | "bottom" | "left";
type StationItemStatus = "neutral" | "info" | "success" | "warning";

type StationPreviewItem = {
  rail: DockingStationRail;
  status: string;
  title: string;
  variant: StationItemStatus;
};

const RAILS: DockingStationRail[] = ["top", "right", "bottom", "left"];

const RAIL_LABELS: Record<DockingStationRail, string> = {
  bottom: "Bottom",
  left: "Left",
  right: "Right",
  top: "Top",
};

const DEFAULT_ENABLED_RAILS: Record<DockingStationRail, boolean> = {
  bottom: true,
  left: true,
  right: true,
  top: true,
};

const STATION_PREVIEW_ITEMS: StationPreviewItem[] = [
  { rail: "top", status: "Clean", title: "Git", variant: "success" },
  { rail: "top", status: "Ready", title: "Templates", variant: "success" },
  { rail: "right", status: "2 review", title: "Queue", variant: "warning" },
  { rail: "bottom", status: "Idle", title: "Terminal", variant: "neutral" },
  { rail: "bottom", status: "Unsaved", title: "Notes", variant: "warning" },
  { rail: "left", status: "Idle", title: "Agent Run", variant: "neutral" },
];

export function DockingStationPlaceholder() {
  const [enabledRails, setEnabledRails] =
    useState<Record<DockingStationRail, boolean>>(DEFAULT_ENABLED_RAILS);

  function toggleRail(rail: DockingStationRail) {
    setEnabledRails((currentRails) => ({
      ...currentRails,
      [rail]: !currentRails[rail],
    }));
  }

  return (
    <aside
      aria-labelledby="docking-station-placeholder-title"
      className="docking-station-placeholder"
    >
      <div className="docking-station-placeholder-meta">
        <div className="docking-station-placeholder-copy">
          <div className="docking-station-placeholder-title-row">
            <h2
              className="docking-station-placeholder-title"
              id="docking-station-placeholder-title"
            >
              Docking Station
            </h2>
            <Badge variant="info">Placeholder</Badge>
            <Badge variant="neutral">Static indicators</Badge>
          </div>
          <p className="docking-station-placeholder-text">
            Preview only. Local rail toggles; no parking, persistence, or
            drag-and-drop.
          </p>
        </div>

        <fieldset
          aria-label="Docking Station preview rail controls"
          className="docking-station-rail-controls"
        >
          <legend className="docking-station-rail-controls-label">
            Preview rails
          </legend>
          <div className="docking-station-rail-toggle-list">
            {RAILS.map((rail) => (
              <label className="docking-station-rail-toggle" key={rail}>
                <input
                  checked={enabledRails[rail]}
                  onChange={() => toggleRail(rail)}
                  type="checkbox"
                />
                <span>{RAIL_LABELS[rail]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div
        aria-label="Static Docking Station perimeter rail preview"
        className="docking-station-preview-grid"
      >
        <StationRail
          enabled={enabledRails.top}
          items={itemsForRail("top")}
          rail="top"
        />
        <StationRail
          enabled={enabledRails.left}
          items={itemsForRail("left")}
          rail="left"
        />
        <div className="docking-station-preview-core">
          <span className="docking-station-preview-core-title">Workbench</span>
          <span className="docking-station-preview-core-text">
            Canvas stays primary
          </span>
        </div>
        <StationRail
          enabled={enabledRails.right}
          items={itemsForRail("right")}
          rail="right"
        />
        <StationRail
          enabled={enabledRails.bottom}
          items={itemsForRail("bottom")}
          rail="bottom"
        />
      </div>
    </aside>
  );
}

type StationRailProps = {
  enabled: boolean;
  items: StationPreviewItem[];
  rail: DockingStationRail;
};

function StationRail({ enabled, items, rail }: StationRailProps) {
  const railClassName = enabled
    ? `docking-station-rail docking-station-rail-${rail}`
    : `docking-station-rail docking-station-rail-${rail} docking-station-rail-disabled`;

  return (
    <div
      aria-label={`${RAIL_LABELS[rail]} rail ${
        enabled ? "enabled static preview" : "disabled preview"
      }`}
      className={railClassName}
    >
      {enabled ? (
        items.map((item) => (
          <div
            aria-label={`Static indicator example: ${item.title} ${item.status}`}
            className="docking-station-indicator"
            key={`${item.rail}-${item.title}`}
          >
            <span className="docking-station-indicator-title">
              {item.title}
            </span>
            <Badge
              className="docking-station-indicator-status"
              variant={item.variant}
            >
              {item.status}
            </Badge>
          </div>
        ))
      ) : (
        <span className="docking-station-rail-disabled-label">
          {RAIL_LABELS[rail]} off
        </span>
      )}
    </div>
  );
}

function itemsForRail(rail: DockingStationRail) {
  return STATION_PREVIEW_ITEMS.filter((item) => item.rail === rail);
}
