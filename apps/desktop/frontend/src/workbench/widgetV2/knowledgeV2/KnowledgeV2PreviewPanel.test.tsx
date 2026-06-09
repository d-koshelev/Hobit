import { afterEach, describe, expect, it } from "vitest";

import { KnowledgeV2Widget } from "./KnowledgeV2Widget";
import {
  cleanupKnowledgeV2WidgetTestDom,
  clickButton,
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
    expect(overview?.textContent).toContain("Vendor SDK reference");
    expect(overview?.textContent).toContain("No summary available yet.");
    expect(overview?.textContent).toContain(
      "Imported reference document. Source preview is available in Details.",
    );
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
    await clickButton("Details");

    const details = regionByName("Knowledge preview");
    expect(details?.textContent).toContain("Source");
    expect(details?.textContent).toContain("Imported SDK source");
    expect(details?.textContent).toContain("Import File");
    expect(details?.textContent).toContain("Vendor.SDK.cs");
    expect(details?.textContent).toContain("Source size");
    expect(details?.textContent).toContain("Source preview");
    expect(details?.textContent).toContain("View source");
    expect(details?.textContent).toContain("#region Assembly Vendor.SDK");
    expect(details?.textContent).toContain("public sealed class Client");
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
    expect(overview?.textContent).toContain(
      "Review recommended; visible preview and context are bounded.",
    );
    expect(overview?.textContent).not.toContain("#region Assembly");

    await clickButton("Details");

    const sourceDetails = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("details"),
    ).find((candidate) =>
      candidate.textContent?.includes("View capped source preview"),
    );
    const sourcePreview = sourceDetails?.querySelector("pre")?.textContent ?? "";

    expect(sourceDetails).not.toBeNull();
    expect(sourceDetails?.open).toBe(false);
    expect(sourcePreview).toContain("#region Assembly Vendor.SDK");
    expect(sourcePreview).not.toContain("TAIL_SHOULD_NOT_RENDER");
    expect(sourcePreview.length).toBeLessThan(largeSource.length);
    expect(regionByName("Knowledge preview")?.textContent).toContain("Capped");
  });
});
