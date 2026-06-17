import { useState } from "react";

import {
  ModuleBody,
  ModuleHeader,
  ModuleHeaderAction,
  ModuleHeaderMinimize,
  ModuleHeaderState,
  ModuleHeaderTitle,
  ModuleShell,
} from "./ModuleShell";

export function ModuleShellExample() {
  const [bodyCollapsed, setBodyCollapsed] = useState(false);

  return (
    <ModuleShell
      aria-label="Dummy module shell example"
      bodyCollapsed={bodyCollapsed}
    >
      <ModuleHeader
        left={
          <>
            <ModuleHeaderTitle>Dummy Module</ModuleHeaderTitle>
            <ModuleHeaderState tone="completed">Completed</ModuleHeaderState>
          </>
        }
        right={
          <>
            <ModuleHeaderAction>Primary</ModuleHeaderAction>
            <ModuleHeaderAction>Activity</ModuleHeaderAction>
            <ModuleHeaderAction aria-label="More dummy module actions">
              More
            </ModuleHeaderAction>
            <ModuleHeaderMinimize
              collapsed={bodyCollapsed}
              onClick={() => setBodyCollapsed((current) => !current)}
            />
          </>
        }
      />
      <ModuleBody collapsed={bodyCollapsed} id="module-shell-example-body">
        <div className="module-shell-example-content">
          <p>Static clean canvas content for the shared module shell.</p>
          <p>Neutral placeholder content inside the module body.</p>
        </div>
      </ModuleBody>
    </ModuleShell>
  );
}
