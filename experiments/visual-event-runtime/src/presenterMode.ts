export type PresenterShortcutAction =
  | { kind: "togglePlay" }
  | { kind: "restart" }
  | { kind: "setSpeed"; speed: 1 | 2 | 5 }
  | { kind: "none" };

const editableElementNames = new Set(["INPUT", "SELECT", "TEXTAREA"]);

export function shouldIgnorePresenterShortcut(elementName: string | undefined) {
  return elementName !== undefined && editableElementNames.has(elementName);
}

export function getPresenterShortcutAction(
  key: string,
): PresenterShortcutAction {
  switch (key.toLowerCase()) {
    case " ":
    case "spacebar":
      return { kind: "togglePlay" };
    case "r":
      return { kind: "restart" };
    case "1":
      return { kind: "setSpeed", speed: 1 };
    case "2":
      return { kind: "setSpeed", speed: 2 };
    case "5":
      return { kind: "setSpeed", speed: 5 };
    default:
      return { kind: "none" };
  }
}
