import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import moduleShellSource from "./ModuleShell.tsx?raw";
import { ModuleShellExample } from "./ModuleShellExample";
import moduleShellExampleSource from "./ModuleShellExample.tsx?raw";
import {
  ModuleBody,
  ModuleHeader,
  ModuleHeaderAction,
  ModuleHeaderMinimize,
  ModuleHeaderState,
  ModuleHeaderTitle,
  ModuleShell,
} from "./ModuleShell";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

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

describe("ModuleShell", () => {
  it("renders title, state, header groups, right actions, and arbitrary body content", async () => {
    await render(
      <ModuleShell aria-label="Test module shell">
        <ModuleHeader
          left={
            <>
              <ModuleHeaderTitle>Review Module</ModuleHeaderTitle>
              <ModuleHeaderState tone="running">Running</ModuleHeaderState>
            </>
          }
          right={
            <>
              <ModuleHeaderAction>Primary</ModuleHeaderAction>
              <ModuleHeaderAction>Activity</ModuleHeaderAction>
            </>
          }
        />
        <ModuleBody>
          <article data-arbitrary-body="true">
            <h3>Arbitrary body content</h3>
            <p>Any body node can render here.</p>
          </article>
        </ModuleBody>
      </ModuleShell>,
    );

    expect(document.body.textContent).toContain("Review Module");
    expect(document.body.textContent).toContain("Running");
    expect(document.querySelector(".module-header-state-running")).not.toBeNull();
    expect(
      document.querySelector("[data-module-state-tone='running']"),
    ).not.toBeNull();

    const leftGroup = group("left");
    const rightGroup = group("right");

    expect(leftGroup.textContent).toContain("Review Module");
    expect(leftGroup.textContent).toContain("Running");
    expect(rightGroup.textContent).toContain("Primary");
    expect(rightGroup.textContent).toContain("Activity");
    expect(rightGroup.querySelectorAll(".module-header-action")).toHaveLength(2);
    expect(document.querySelector(".module-header-center")).toBeNull();
    expect(document.querySelector("[data-module-header-group='center']")).toBeNull();
    expect(document.querySelector("[data-arbitrary-body='true']")).not.toBeNull();
  });

  it("collapses only the body while keeping the header visible", async () => {
    function CollapsibleModule() {
      const [collapsed, setCollapsed] = useState(false);

      return (
        <ModuleShell bodyCollapsed={collapsed}>
          <ModuleHeader
            left={
              <>
                <ModuleHeaderTitle>Collapsible Module</ModuleHeaderTitle>
                <ModuleHeaderState tone="idle">Idle</ModuleHeaderState>
              </>
            }
            right={
              <ModuleHeaderMinimize
                collapsed={collapsed}
                onClick={() => setCollapsed((current) => !current)}
              />
            }
          />
          <ModuleBody collapsed={collapsed} id="collapsible-module-body">
            <p>Body-only content</p>
          </ModuleBody>
        </ModuleShell>
      );
    }

    await render(<CollapsibleModule />);

    const body = document.querySelector<HTMLDivElement>(
      "#collapsible-module-body",
    );
    expect(body).not.toBeNull();
    expect(body?.hidden).toBe(false);
    expect(document.querySelector(".module-header")?.textContent).toContain(
      "Collapsible Module",
    );

    await click(buttonWithAriaLabel("Collapse module body"));

    expect(body?.hidden).toBe(true);
    expect(document.querySelector(".module-header")?.textContent).toContain(
      "Collapsible Module",
    );
    expect(buttonWithAriaLabel("Expand module body")).not.toBeNull();
  });

  it("renders the dummy example without product dependencies", async () => {
    await render(<ModuleShellExample />);

    expect(document.body.textContent).toContain("Dummy Module");
    expect(document.body.textContent).toContain("Completed");
    expect(group("right").textContent).toContain("Primary");
    expect(group("right").textContent).toContain("Activity");
    expect(group("right").textContent).toContain("More");
    expect(document.querySelector(".module-header-state-completed")).not.toBeNull();

    expectForbiddenImports(moduleShellExampleSource);
  });

  it("keeps ModuleShell source imports domain-free", () => {
    expectForbiddenImports(moduleShellSource);
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

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function buttonWithAriaLabel(label: string) {
  const button = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function group(side: "left" | "right") {
  const element = document.querySelector<HTMLElement>(
    `[data-module-header-group="${side}"]`,
  );

  if (!element) {
    throw new Error(`Module header ${side} group not found.`);
  }

  return element;
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
