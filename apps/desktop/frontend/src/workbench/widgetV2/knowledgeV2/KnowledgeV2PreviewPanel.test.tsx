import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  cleanupKnowledgeV2WidgetTestDom,
  clickButton,
  clickButtonInRegion,
  documentFixture,
  regionByName,
  render,
} from "./KnowledgeV2Widget.test-helpers";

afterEach(() => {
  cleanupKnowledgeV2WidgetTestDom();
});

describe("KnowledgeV2PreviewPanel", () => {
  it("keeps imported code source out of the Overview primary body", async () => {
    const source =
      "#region Assembly Vendor.SDK\n" +
      "public sealed class GeneratedClient\n" +
      "{\n" +
      "  public void Connect() {}\n" +
      "}\n";

    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            catalogItemType: "codebase_knowledge",
            content: source,
            quickSummary: "",
            sourceKind: "import_file",
            sourceLabel: "Imported SDK source",
            sourceRef: "Vendor.SDK.cs",
            title: "Vendor SDK reference",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Vendor SDK reference");

    const overview = regionByName("Knowledge preview");
    const overviewPanel = document.querySelector<HTMLElement>(
      ".knowledge-v2-tab-panel",
    );
    expect(
      document.querySelector<HTMLElement>(".popup-shell-title")?.textContent,
    ).toBe("Vendor SDK reference");
    expect(overview?.textContent).toContain("No summary available yet.");
    expect(overview?.textContent).toContain(
      "Reference document. Source content is available in Source.",
    );
    expect(overviewPanel?.textContent).not.toContain("Scope");
    expect(overviewPanel?.textContent).not.toContain("Source size");
    expect(overviewPanel?.textContent).not.toContain("Version");
    expect(overviewPanel?.textContent).not.toContain("Updated");
    expect(overview?.textContent).not.toContain("#region Assembly");
    expect(overview?.textContent).not.toContain("public sealed class");
    expect(overview?.textContent).not.toContain("GeneratedClient");
  });

  it("renders Details source metadata and bounded source preview", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            content: "#region Assembly Vendor.SDK\npublic sealed class Client {}",
            quickSummary: "",
            sourceKind: "import_file",
            sourceLabel: "Imported SDK source",
            sourceRef: "Vendor.SDK.cs",
            title: "Vendor SDK reference",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Vendor SDK reference");
    await clickButtonInRegion("Knowledge preview", "Details");

    const details = regionByName("Knowledge preview");
    expect(details?.textContent).toContain("Source");
    expect(details?.textContent).toContain("Imported SDK source");
    expect(details?.textContent).toContain("Import File");
    expect(details?.textContent).toContain("Vendor.SDK.cs");
    expect(details?.textContent).toContain("Source size");

    await clickButtonInRegion("Knowledge preview", "Source");
    const source = regionByName("Knowledge preview");
    expect(source?.textContent).toContain("Source content");
    expect(source?.textContent).toContain("#region Assembly Vendor.SDK");
    expect(source?.textContent).toContain("public sealed class Client");
  });

  it("caps and collapses large source preview in Details", async () => {
    const largeSource = [
      "#region Assembly Vendor.SDK",
      "public sealed class GeneratedClient {}",
      "namespace Vendor.Generated {",
      "  public sealed class GeneratedType {}",
      "}",
      "middle ".repeat(2_400),
      "TAIL_SHOULD_NOT_RENDER",
    ].join("\n");

    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            content: largeSource,
            quickSummary: "",
            sourceKind: "import_file",
            sourceLabel: "Large imported source",
            sourceRef: "Vendor.SDK.cs",
            title: "Large imported SDK reference",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Large imported SDK reference");

    const overview = regionByName("Knowledge preview");
    expect(overview?.textContent).toContain("Large");
    expect(overview?.textContent).toContain("2 warnings: Missing summary, Large");
    expect(overview?.textContent).not.toContain(
      "Large document preview is capped in this browser.",
    );
    expect(overview?.textContent).not.toContain("#region Assembly");

    await clickButtonInRegion("Knowledge preview", "Details");
    await clickButton("Show details");
    expect(regionByName("Knowledge preview warnings")?.textContent).toContain(
      "Large document preview is capped in this browser.",
    );

    await clickButtonInRegion("Knowledge preview", "Source");

    const sourcePreview =
      regionByName("Knowledge source content")?.textContent ?? "";

    expect(sourcePreview).toContain("#region Assembly Vendor.SDK");
    expect(sourcePreview).not.toContain("TAIL_SHOULD_NOT_RENDER");
    expect(sourcePreview.length).toBeLessThan(largeSource.length);
    expect(regionByName("Knowledge preview")?.textContent).toContain("Capped");
  });

  it("renders warning summaries by default and expands full warning text", async () => {
    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            enabled: false,
            knowledgeDocumentId: "disabled",
            lifecycleStatus: "rejected",
            searchable: false,
            title: "Rejected safety note",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Rejected safety note");

    const warnings = regionByName("Knowledge preview warnings");
    expect(warnings?.textContent).toContain("3 warnings");
    expect(warnings?.textContent).toContain("Unavailable");
    expect(warnings?.textContent).toContain("Not searchable");
    expect(warnings?.textContent).toContain("Rejected");
    expect(warnings?.textContent).not.toContain(
      "Rejected document is unavailable for normal catalog use.",
    );

    await clickButtonInRegion("Knowledge preview", "Details");
    await clickButton("Show details");

    expect(regionByName("Knowledge preview warnings")?.textContent).toContain(
      "Rejected document is unavailable for normal catalog use.",
    );
    expect(regionByName("Knowledge preview warnings")?.textContent).toContain(
      "Document is marked not searchable.",
    );
  });

  it("renders published active status compactly with context usability", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const compactStatus = regionByName("Knowledge preview compact status");
    expect(compactStatus).toBeNull();
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "Context: Usable",
    );
    expect(regionByName("Knowledge preview")?.textContent).not.toContain(
      "Ready and usable as Knowledge context",
    );
  });

  it("renders item details as a product-sized bounded popup without duplicating the title", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const popup = document.querySelector<HTMLElement>(
      "#knowledge-v2-item-details-popup",
    );
    expect(popup).not.toBeNull();
    expect(popup?.classList.contains("knowledge-v2-product-detail-size")).toBe(
      true,
    );
    expect(popup?.classList.contains("knowledge-v2-details-popup-shell")).toBe(
      true,
    );
    expect(popup?.classList.contains("popup-shell-floating")).toBe(true);
    expect(
      document.querySelector<HTMLElement>(".popup-shell-header")?.getAttribute(
        "data-popup-drag-handle",
      ),
    ).toBe("true");
    expect(
      document.querySelector<HTMLElement>(".knowledge-v2-details-popup-body"),
    ).not.toBeNull();
    expect(
      document.querySelector<HTMLElement>(".knowledge-v2-details-popup-footer"),
    ).not.toBeNull();

    const popupTitleCount = Array.from(
      popup?.querySelectorAll("h1,h2,h3") ?? [],
    ).filter((heading) => heading.textContent === "Release guide").length;
    expect(popupTitleCount).toBe(1);
    expect(popup?.querySelector(".popup-shell-eyebrow")).toBeNull();
    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".knowledge-v2-status-grid-compact",
        ),
      ).filter((element) => popup?.contains(element)).length,
    ).toBe(0);
  });

  it("renders full metadata only in the Details tab", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const overview = document.querySelector<HTMLElement>(
      ".knowledge-v2-tab-panel",
    );
    expect(overview?.textContent).not.toContain("Scope");
    expect(overview?.textContent).not.toContain("Version");
    expect(overview?.textContent).not.toContain("Updated");
    expect(overview?.textContent).not.toContain("Searchable");

    await clickButtonInRegion("Knowledge preview", "Details");

    const details = regionByName("Knowledge preview");
    expect(details?.textContent).toContain("Source");
    expect(details?.textContent).toContain("Release docs");
    expect(details?.textContent).toContain("Scope");
    expect(details?.textContent).toContain("Workspace");
    expect(details?.textContent).toContain("Version");
    expect(details?.textContent).toContain("Not available");
    expect(details?.textContent).toContain("Created");
    expect(details?.textContent).toContain("2026-01-01");
    expect(details?.textContent).toContain("Updated");
    expect(details?.textContent).toContain("2026-01-02");
    expect(details?.textContent).toContain("Searchable");
    expect(details?.textContent).toContain("Yes");
  });

  it("keeps the details popup footer to action buttons only", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const footer = document.querySelector<HTMLElement>(
      ".knowledge-v2-details-popup-footer",
    );
    expect(footer).not.toBeNull();
    expect(
      Array.from(footer?.querySelectorAll("button") ?? []).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(["Use as context", "Archive", "Delete", "Close"]);
    expect(footer?.querySelector("p")).toBeNull();
    expect(footer?.textContent).not.toContain(
      "Use as context opens explicit visible context targets only.",
    );
  });

  it("keeps raw source in the Source tab instead of Overview in the details popup", async () => {
    const source =
      "#region Assembly Vendor.SDK\n" +
      "public sealed class GeneratedClient\n" +
      "{\n" +
      "  public void Connect() {}\n" +
      "}\n";

    await render(
      <KnowledgeV2Widget
        documents={[
          documentFixture({
            content: source,
            quickSummary: "SDK integration reference.",
            sourceKind: "import_file",
            title: "Vendor SDK reference",
          }),
        ]}
        skills={[]}
      />,
    );

    await clickButton("Vendor SDK reference");

    const body = regionByName("Knowledge preview");
    expect(body?.textContent).toContain("SDK integration reference.");
    expect(body?.textContent).not.toContain("#region Assembly");
    expect(body?.textContent).not.toContain("GeneratedClient");

    await clickButtonInRegion("Knowledge preview", "Source");

    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "#region Assembly Vendor.SDK",
    );
    expect(regionByName("Knowledge preview")?.textContent).toContain(
      "GeneratedClient",
    );
  });

  it("keeps popup body scrollable while footer actions remain outside the scroll body", async () => {
    await render(
      <KnowledgeV2Widget documents={[documentFixture()]} skills={[]} />,
    );

    await clickButton("Release guide");

    const body = document.querySelector<HTMLElement>(
      ".knowledge-v2-details-popup-body",
    );
    const footer = document.querySelector<HTMLElement>(
      ".knowledge-v2-details-popup-footer",
    );

    expect(body?.getAttribute("data-popup-body")).toBe("true");
    expect(body?.classList.contains("popup-shell-body")).toBe(true);
    expect(footer?.classList.contains("popup-shell-footer")).toBe(true);
    const footerCloseButton =
      Array.from(footer?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent?.trim() === "Close",
      ) ?? null;
    expect(
      Array.from(body?.querySelectorAll("button") ?? []).some(
        (button) => button.textContent?.trim() === "Close",
      ),
    ).toBe(false);
    expect(footerCloseButton).not.toBeNull();
  });

  it("does not call item action callbacks when the details popup opens", async () => {
    const onAttachContextToCoordinator = vi.fn();
    const onDeleteKnowledgeDocument = vi.fn();
    const onUpdateKnowledgeDocument = vi.fn();

    await render(
      <KnowledgeV2Widget
        documents={[documentFixture()]}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onDeleteKnowledgeDocument={onDeleteKnowledgeDocument}
        onUpdateKnowledgeDocument={onUpdateKnowledgeDocument}
        skills={[]}
      />,
    );

    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();
    expect(onDeleteKnowledgeDocument).not.toHaveBeenCalled();
    expect(onUpdateKnowledgeDocument).not.toHaveBeenCalled();

    await clickButton("Release guide");

    expect(regionByName("Knowledge preview")).not.toBeNull();
    expect(onAttachContextToCoordinator).not.toHaveBeenCalled();
    expect(onDeleteKnowledgeDocument).not.toHaveBeenCalled();
    expect(onUpdateKnowledgeDocument).not.toHaveBeenCalled();
  });
});
