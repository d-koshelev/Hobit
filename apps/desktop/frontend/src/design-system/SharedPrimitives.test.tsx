import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useState, type ReactNode } from "react";
import {
  CheckboxField,
  Field,
  InlineError,
  Notice,
  Tabs,
  Textarea,
} from "./index";
import { Input } from "./Input";

let container: HTMLElement | null = null;
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

describe("shared form primitives", () => {
  it("renders field labels, helper text, and error", async () => {
    await render(
      <Field
        error="A valid email is required"
        helperText="Use workspace email"
        id="workspace-email"
        label="Workspace email"
      >
        <Input placeholder="name@company.com" type="email" />
      </Field>,
    );

    expect(document.querySelector("label")?.textContent).toBe("Workspace email");
    expect(document.querySelector(".ui-field-help")?.textContent).toContain(
      "Use workspace email",
    );
    expect(document.querySelector(".ui-inline-error")?.textContent).toContain(
      "A valid email is required",
    );
  });

  it("toggles checkbox state through user interaction", async () => {
    const onChange = vi.fn();

    await render(
      <CheckboxField label="I agree" onChange={onChange} />,
    );

    const checkbox = document.querySelector<HTMLInputElement>("#workspace-agent-checkbox");

    expect(checkbox).toBeNull();

    const generatedCheckbox = document.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    );

    expect(generatedCheckbox).not.toBeNull();
    expect(generatedCheckbox?.checked).toBe(false);

    await click(generatedCheckbox);

    expect(generatedCheckbox?.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("renders textarea with shared class", async () => {
    await render(<Textarea id="notes" placeholder="Write..." />);

    const element = document.getElementById("notes");

    expect(element).not.toBeNull();
    expect(element?.className).toContain("ui-textarea");
  });
});

describe("shared tabs primitive", () => {
  it("supports selection and keyboard navigation", async () => {
    function TabsHarness() {
      const [selected, setSelected] = useState<"overview" | "settings">("overview");

      return (
        <Tabs
          items={[
            { id: "overview", label: "Overview", panel: <p>Overview content</p> },
            { id: "settings", label: "Settings", panel: <p>Settings content</p> },
          ]}
          onSelectedChange={setSelected}
          selected={selected}
        />
      );
    }

    await render(<TabsHarness />);

    const tabList = document.querySelector<HTMLElement>("[role='tablist']");
    const first = document.querySelector<HTMLButtonElement>("[role='tab']");
    const second = document.querySelectorAll<HTMLButtonElement>("[role='tab']")[1];

    expect(tabList).not.toBeNull();
    expect(first?.getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent).toContain("Overview content");

    await click(second);

    expect(first?.getAttribute("aria-selected")).toBe("false");
    expect(second?.getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent).toContain("Settings content");
  });
});

describe("shared feedback primitives", () => {
  it("renders notice and inline error", async () => {
    await render(
      <div>
        <Notice title="Plan" variant="warning">
          Use compact panels for shared metadata.
        </Notice>
        <InlineError>Error text</InlineError>
      </div>,
    );

    const notice = document.querySelector<HTMLElement>(".ui-notice");
    const inlineError = document.querySelector<HTMLElement>(".ui-inline-error");

    expect(notice).not.toBeNull();
    expect(notice?.className).toContain("ui-notice-warning");
    expect(notice?.textContent).toContain("Use compact panels");
    expect(inlineError).not.toBeNull();
    expect(inlineError?.textContent).toEqual("Error text");
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

async function click(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  if (element instanceof HTMLButtonElement && element.disabled) {
    return;
  }
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}
