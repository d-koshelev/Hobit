import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  widgetCatalogSectionDescriptions,
  widgetCatalogSectionLabels,
  widgetCatalogSectionOrder,
  widgetCatalogTemplates,
  type WidgetCatalogTemplate,
  type WidgetCatalogSection,
} from "./catalogTemplates";

type WidgetCatalogShellProps = {
  isOpen: boolean;
  onAddTemplate?: (template: WidgetCatalogTemplate) => void | Promise<void>;
  onClose: () => void;
};

export function WidgetCatalogShell({
  isOpen,
  onAddTemplate,
  onClose,
}: WidgetCatalogShellProps) {
  if (!isOpen) {
    return null;
  }

  const templateGroups = widgetCatalogSectionOrder
    .map((section) => ({
      section,
      templates: widgetCatalogTemplates.filter(
        (template) => template.section === section,
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
              Choose from the current kept workbench surfaces.
            </p>
          </div>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </header>

        <div className="widget-catalog-body">
          {templateGroups.map((group) => (
            <section
              className={[
                "catalog-template-group",
                `catalog-template-group-${group.section}`,
              ].join(" ")}
              key={group.section}
            >
              <div className="catalog-template-group-header">
                <div className="catalog-template-group-heading">
                  <h3 className="catalog-template-group-title">
                    {widgetCatalogSectionLabels[group.section]}
                  </h3>
                  <p className="catalog-template-group-description">
                    {widgetCatalogSectionDescriptions[group.section]}
                  </p>
                </div>
              </div>
              <div className="catalog-template-list">
                {group.templates.map((template) => (
                  <CatalogTemplateCard
                    key={template.id}
                    onAddTemplate={onAddTemplate}
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
  onAddTemplate?: (template: WidgetCatalogTemplate) => void | Promise<void>;
  template: WidgetCatalogTemplate;
};

function CatalogTemplateCard({
  onAddTemplate,
  template,
}: CatalogTemplateCardProps) {
  const canAddTemplate =
    template.status === "available" && onAddTemplate !== undefined;

  return (
    <article className="catalog-template-card">
      <div className="catalog-template-card-main">
        <div className="catalog-template-card-header">
          <h4 className="catalog-template-title">{template.title}</h4>
          <Badge variant={sectionBadgeVariant(template.section)}>
            {sectionLabel(template.section)}
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
      <Button
        disabled={!canAddTemplate}
        onClick={() => {
          void onAddTemplate?.(template);
        }}
        variant="secondary"
      >
        {template.status === "available" ? "Add widget" : "Not available"}
      </Button>
    </article>
  );
}

function sectionLabel(section: WidgetCatalogSection) {
  return widgetCatalogSectionLabels[section];
}

function sectionBadgeVariant(section: WidgetCatalogSection) {
  if (section === "ready") {
    return "success";
  }

  if (section === "preview") {
    return "info";
  }

  return "neutral";
}
