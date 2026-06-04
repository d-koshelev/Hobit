import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  widgetCatalogCategoryDescriptions,
  widgetCatalogCategoryLabels,
  widgetCatalogCategoryOrder,
  widgetCatalogReadinessLabels,
  widgetCatalogTemplates,
  type WidgetCatalogReadiness,
  type WidgetCatalogTemplate,
} from "./catalogTemplates";

type WidgetCatalogShellProps = {
  isOpen: boolean;
  onAddTemplate?: (template: WidgetCatalogTemplate) => void | Promise<void>;
  onClose: () => void;
  unavailableTemplateMessages?: Partial<
    Record<string, CatalogTemplateUnavailableMessage>
  >;
};

export function WidgetCatalogShell({
  isOpen,
  onAddTemplate,
  onClose,
  unavailableTemplateMessages,
}: WidgetCatalogShellProps) {
  if (!isOpen) {
    return null;
  }

  const templateGroups = widgetCatalogCategoryOrder
    .map((catalogCategory) => ({
      catalogCategory,
      templates: widgetCatalogTemplates.filter(
        (template) => template.catalogCategory === catalogCategory,
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
                `catalog-template-group-${group.catalogCategory}`,
              ].join(" ")}
              key={group.catalogCategory}
            >
              <div className="catalog-template-group-header">
                <div className="catalog-template-group-heading">
                  <h3 className="catalog-template-group-title">
                    {widgetCatalogCategoryLabels[group.catalogCategory]}
                  </h3>
                  <p className="catalog-template-group-description">
                    {widgetCatalogCategoryDescriptions[group.catalogCategory]}
                  </p>
                </div>
              </div>
              <div className="catalog-template-list">
                {group.templates.map((template) => (
                  <CatalogTemplateCard
                    key={template.id}
                    onAddTemplate={onAddTemplate}
                    template={template}
                    unavailableMessage={
                      unavailableTemplateMessages?.[
                        template.futureWidgetDefinitionId ?? template.id
                      ]
                    }
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
  unavailableMessage?: CatalogTemplateUnavailableMessage;
};

function CatalogTemplateCard({
  onAddTemplate,
  template,
  unavailableMessage,
}: CatalogTemplateCardProps) {
  const canAddTemplate =
    template.availability === "available" &&
    unavailableMessage === undefined &&
    onAddTemplate !== undefined;

  return (
    <article
      className={`catalog-template-card${
        unavailableMessage ? " catalog-template-card-unavailable" : ""
      }`}
      data-catalog-category={template.catalogCategory}
      data-catalog-readiness={template.readiness}
      data-catalog-template-id={template.futureWidgetDefinitionId ?? template.id}
    >
      <div className="catalog-template-card-main">
        <div className="catalog-template-card-header">
          <h4 className="catalog-template-title">{template.title}</h4>
          <Badge variant={readinessBadgeVariant(template.readiness)}>
            {readinessLabel(template.readiness)}
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
        {unavailableMessage ? (
          <p className="catalog-template-unavailable-reason">
            {unavailableMessage.reason}
          </p>
        ) : null}
      </div>
      <Button
        disabled={!canAddTemplate}
        onClick={() => {
          void onAddTemplate?.(template);
        }}
        variant="secondary"
      >
        {unavailableMessage?.actionLabel ??
          (template.availability === "available"
            ? "Add widget"
            : "Not available")}
      </Button>
    </article>
  );
}

type CatalogTemplateUnavailableMessage = {
  actionLabel: string;
  reason: string;
};

function readinessLabel(readiness: WidgetCatalogReadiness) {
  return widgetCatalogReadinessLabels[readiness];
}

function readinessBadgeVariant(readiness: WidgetCatalogReadiness) {
  if (readiness === "ready") {
    return "success";
  }

  if (readiness === "preview") {
    return "info";
  }

  return "neutral";
}
