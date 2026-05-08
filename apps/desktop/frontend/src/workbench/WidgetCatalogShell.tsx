import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  plannedWidgetCatalogTemplates,
  widgetCatalogCategoryLabels,
  widgetCatalogCategoryOrder,
  type WidgetCatalogTemplate,
  type WidgetCatalogTemplateStatus,
} from "./catalogTemplates";

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

  const templateGroups = widgetCatalogCategoryOrder
    .map((category) => ({
      category,
      templates: plannedWidgetCatalogTemplates.filter(
        (template) => template.category === category,
      ),
    }))
    .filter((group) => group.templates.length > 0);

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

        <div className="widget-catalog-body">
          {templateGroups.map((group) => (
            <section className="catalog-template-group" key={group.category}>
              <h3 className="catalog-template-group-title">
                {widgetCatalogCategoryLabels[group.category]}
              </h3>
              <div className="catalog-template-list">
                {group.templates.map((template) => (
                  <CatalogTemplateCard
                    key={template.id}
                    template={template}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

type CatalogTemplateCardProps = {
  template: WidgetCatalogTemplate;
};

function CatalogTemplateCard({ template }: CatalogTemplateCardProps) {
  return (
    <article className="catalog-template-card">
      <div className="catalog-template-card-main">
        <div className="catalog-template-card-header">
          <h4 className="catalog-template-title">{template.title}</h4>
          <Badge variant={statusBadgeVariant(template.status)}>
            {statusLabel(template.status)}
          </Badge>
        </div>
        <p className="catalog-template-description">{template.description}</p>
        <ul className="catalog-template-capabilities">
          {template.capabilitySummary.map((capability) => (
            <li className="catalog-template-capability" key={capability}>
              {capability}
            </li>
          ))}
        </ul>
      </div>
      <Button disabled variant="secondary">
        Not available yet
      </Button>
    </article>
  );
}

function statusLabel(status: WidgetCatalogTemplateStatus) {
  return status === "available" ? "Available" : "Planned";
}

function statusBadgeVariant(status: WidgetCatalogTemplateStatus) {
  return status === "available" ? "success" : "neutral";
}
