import { Button } from "../design-system/Button";

type WidgetCatalogShellProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function WidgetCatalogShell({
  isOpen,
  onClose,
}: WidgetCatalogShellProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="widget-catalog-layer">
      <aside
        aria-labelledby="widget-catalog-title"
        className="widget-catalog-drawer"
        role="dialog"
      >
        <header className="widget-catalog-header">
          <div className="widget-catalog-heading">
            <h2 className="widget-catalog-title" id="widget-catalog-title">
              Widget Catalog
            </h2>
            <p className="widget-catalog-subtitle">
              Add widgets to compose your AI workspace.
            </p>
          </div>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </header>

        <div className="widget-catalog-empty">
          <p className="widget-catalog-empty-title">
            No widget templates configured yet.
          </p>
          <p className="widget-catalog-empty-text">
            Widget templates will appear here when they are added to the
            catalog.
          </p>
        </div>
      </aside>
    </div>
  );
}
