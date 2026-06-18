import { readFileSync } from "fs";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import moduleControlsSource from "./ModuleControls.tsx?raw";
import {
  ModuleButton,
  ModuleField,
  ModuleKeyValueRow,
  ModuleMonoText,
  ModuleMutedText,
  ModuleNotice,
  ModuleSectionTitle,
  ModuleStatus,
  ModuleStatusBadge,
  ModuleTextArea,
  ModuleTextBlock,
  ModuleTextInput,
  type ModuleButtonVariant,
  type ModuleNoticeTone,
  type ModuleStatusTone,
} from "./ModuleControls";

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const moduleTokenStyles = readFrontendFile("src/styles/tokens.css");
const moduleWidgetStyles = readFrontendFile("src/styles/ui/widget.css");

afterEach(() => {
  if (container && root) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }

  container = null;
  root = null;
  document.body.innerHTML = "";
});

describe("ModuleControls", () => {
  it("renders a text input with label, placeholder, value, and helper text", async () => {
    await render(
      <ModuleField helperText="Short helper" label="Module label">
        <ModuleTextInput
          defaultValue="Static value"
          placeholder="Module placeholder"
        />
      </ModuleField>,
    );

    const input = document.querySelector<HTMLInputElement>(".module-text-input");
    const label = document.querySelector<HTMLLabelElement>(".module-field-label");
    const hint = document.querySelector<HTMLElement>(".module-field-hint");

    expect(label?.textContent).toBe("Module label");
    expect(input?.placeholder).toBe("Module placeholder");
    expect(input?.value).toBe("Static value");
    expect(input?.id).toBeTruthy();
    expect(label?.htmlFor).toBe(input?.id);
    expect(hint?.textContent).toBe("Short helper");
    expect(input?.getAttribute("aria-describedby")).toBe(hint?.id);
  });

  it("renders a text area and error state", async () => {
    await render(
      <ModuleField error="Required content" label="Module body">
        <ModuleTextArea
          defaultValue="Longer static body"
          placeholder="Write module body"
          rows={4}
        />
      </ModuleField>,
    );

    const textarea =
      document.querySelector<HTMLTextAreaElement>(".module-text-area");

    expect(textarea?.placeholder).toBe("Write module body");
    expect(textarea?.value).toBe("Longer static body");
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    expect(document.body.textContent).toContain("Required content");
    expect(document.querySelector("[role='alert']")).not.toBeNull();
  });

  it("renders module button variants and sizes", async () => {
    const variants: readonly ModuleButtonVariant[] = [
      "primary",
      "secondary",
      "ghost",
      "danger",
      "quiet",
    ];

    await render(
      <>
        {variants.map((variant) => (
          <ModuleButton key={variant} size="compact" variant={variant}>
            {variant}
          </ModuleButton>
        ))}
      </>,
    );

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".module-button"),
    );

    expect(buttons).toHaveLength(variants.length);
    expect(buttons.map((button) => button.dataset.moduleButtonVariant)).toEqual(
      variants,
    );
    expect(buttons.every((button) => button.dataset.moduleButtonSize === "compact"))
      .toBe(true);
  });

  it("renders disabled module button state", async () => {
    await render(
      <ModuleButton disabled variant="secondary">
        Disabled action
      </ModuleButton>,
    );

    const button = document.querySelector<HTMLButtonElement>(".module-button");

    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe("Disabled action");
  });

  it("renders selected module button semantics with a flat pressed state", async () => {
    await render(
      <ModuleButton aria-pressed={true} variant="secondary">
        Selected option
      </ModuleButton>,
    );

    const button = document.querySelector<HTMLButtonElement>(".module-button");
    const selectedRule = extractCssRule(
      moduleWidgetStyles,
      '.module-button[aria-pressed="true"]:not(:disabled)',
    );

    expect(button?.getAttribute("aria-pressed")).toBe("true");
    expect(moduleTokenStyles).toContain(
      "--module-button-selected-background: #303841;",
    );
    expect(moduleTokenStyles).toContain(
      "--module-button-selected-hover-background: #36404a;",
    );
    expect(moduleTokenStyles).toContain(
      "--module-button-selected-active-background: #3a4651;",
    );
    expect(moduleTokenStyles).toContain(
      "--module-button-selected-border: #596675;",
    );
    expect(moduleTokenStyles).toContain(
      "--module-button-selected-text: #f6f8fa;",
    );
    expect(moduleTokenStyles).not.toContain(
      "--module-button-selected-accent-color",
    );
    expect(selectedRule).toContain(
      "border-color: var(--module-button-selected-border);",
    );
    expect(selectedRule).toContain(
      "background: var(--module-button-selected-background);",
    );
    expect(selectedRule).toContain(
      "color: var(--module-button-selected-text);",
    );
    expect(selectedRule).toContain("box-shadow: none;");
    expect(selectedRule).not.toContain("border-left");
    expect(selectedRule).not.toContain("inset 2px 0");
    expect(selectedRule).not.toContain("selected-accent");
    expect(selectedRule).not.toContain("selected-left-accent");
    expect(selectedRule).not.toContain("left-rail");
    expect(selectedRule).not.toContain("glow");
    expect(
      extractCssRule(
        moduleWidgetStyles,
        '.module-button[aria-pressed="true"]:not(:disabled):hover',
      ),
    ).toContain("background: var(--module-button-selected-hover-background);");
    expect(
      extractCssRule(
        moduleWidgetStyles,
        '.module-button[aria-pressed="true"]:not(:disabled):active',
      ),
    ).toContain("background: var(--module-button-selected-active-background);");
  });

  it("renders required module status tones", async () => {
    const tones: readonly ModuleStatusTone[] = [
      "idle",
      "active",
      "running",
      "completed",
      "blocked",
      "error",
      "draft",
      "disabled",
    ];

    await render(
      <>
        {tones.map((tone) => (
          <ModuleStatus key={tone} tone={tone} />
        ))}
        <ModuleStatusBadge tone="completed">Done</ModuleStatusBadge>
      </>,
    );

    const statuses = Array.from(
      document.querySelectorAll<HTMLElement>(".module-status"),
    );

    expect(statuses.map((status) => status.dataset.moduleStatusTone)).toEqual(
      tones,
    );
    expect(document.querySelectorAll(".module-status-dot")).toHaveLength(
      tones.length,
    );
    expect(
      document.querySelector(".module-status-badge-completed")?.textContent,
    ).toBe("Done");
  });

  it("renders text blocks, key value rows, mono text, and notice tones", async () => {
    const tones: readonly ModuleNoticeTone[] = [
      "info",
      "success",
      "warning",
      "error",
      "neutral",
    ];

    await render(
      <ModuleTextBlock>
        <ModuleSectionTitle>Section title</ModuleSectionTitle>
        <ModuleMutedText>Muted paragraph</ModuleMutedText>
        <ModuleKeyValueRow
          label="Token"
          value={<ModuleMonoText>--module-token</ModuleMonoText>}
        />
        {tones.map((tone) => (
          <ModuleNotice key={tone} title={tone} tone={tone}>
            Notice body
          </ModuleNotice>
        ))}
      </ModuleTextBlock>,
    );

    expect(document.body.textContent).toContain("Section title");
    expect(document.body.textContent).toContain("Muted paragraph");
    expect(document.querySelector(".module-mono-text")?.textContent).toBe(
      "--module-token",
    );
    expect(
      Array.from(document.querySelectorAll<HTMLElement>(".module-notice")).map(
        (notice) => notice.dataset.moduleNoticeTone,
      ),
    ).toEqual(tones);
  });

  it("uses module radius theme variables for controls and notices", () => {
    expect(moduleTokenStyles).toContain(
      "--module-radius: 2px;",
    );
    expect(moduleTokenStyles).toContain(
      "--module-control-radius: var(--module-radius);",
    );
    expect(moduleTokenStyles).toContain(
      "--module-popup-radius: var(--module-radius);",
    );
    expect(moduleWidgetStyles).toContain(
      "border-radius: var(--module-control-radius);",
    );
    expect(moduleWidgetStyles).toContain(
      "border-radius: var(--module-radius);",
    );
    expect(moduleTokenStyles).not.toContain("--module-theme-radius-control");
    expect(moduleWidgetStyles).not.toContain("--module-theme-radius-control");
    expect(moduleWidgetStyles).not.toContain(
      "border-radius: var(--radius-2xs);",
    );
  });

  it("keeps ModuleControls primitive source imports domain-free", () => {
    expectForbiddenImports(moduleControlsSource);
  });
});

async function render(element: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(element);
    await Promise.resolve();
  });
}

function expectForbiddenImports(source: string) {
  const imports = extractImportText(source);

  for (const term of [
    "queue",
    "workspaceagent",
    "workspace-agent",
    "interactive-agent",
    "knowledge",
    "skill",
    "terminal",
    "notes",
    "agentactivity",
    "agent-activity",
    "scheduler",
    "runtime",
    "backend",
    "tauri",
    "workbench",
    "widgethost",
    "widgetregistry",
    "widgetframe",
    "widgetv2shell",
    "storage",
    "schema",
  ]) {
    expect(imports).not.toContain(term);
  }
}

function extractImportText(source: string) {
  const lines = source.split(/\r?\n/);
  const importLines: string[] = [];
  let inImport = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("import ")) {
      inImport = true;
    }

    if (inImport) {
      importLines.push(trimmed);
    }

    if (inImport && trimmed.endsWith(";")) {
      inImport = false;
    }
  }

  return importLines.join("\n").toLowerCase();
}

function readFrontendFile(path: string) {
  return readFileSync(`${process.cwd()}/${path}`, "utf8");
}

function extractCssRule(source: string, selector: string) {
  const selectorIndex = source.indexOf(selector);

  if (selectorIndex === -1) {
    throw new Error(`CSS selector not found: ${selector}`);
  }

  const ruleStart = source.indexOf("{", selectorIndex);
  const ruleEnd = source.indexOf("}", ruleStart);

  if (ruleStart === -1 || ruleEnd === -1) {
    throw new Error(`CSS rule not found: ${selector}`);
  }

  return source.slice(ruleStart + 1, ruleEnd);
}
