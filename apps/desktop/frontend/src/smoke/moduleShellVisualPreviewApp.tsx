import ReactDOM from "react-dom/client";

import "../styles/hobit-theme.css";
import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/layout.css";
import "./moduleShellVisualPreview.css";

import { ModuleShellExample } from "../design-system/widget/ModuleShellExample";

export function ModuleShellVisualPreviewApp() {
  return (
    <main
      aria-label="ModuleShell visual preview"
      className="app-shell module-shell-visual-preview"
    >
      <div className="module-shell-visual-preview__stage">
        <ModuleShellExample />
      </div>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<ModuleShellVisualPreviewApp />);
}
