import type { ComponentProps } from "react";
import { Button } from "../design-system/Button";
import { TerminalPtySettingsBody } from "./TerminalPtySessionPanelParts";

type TerminalPtySettingsPopoverProps = ComponentProps<
  typeof TerminalPtySettingsBody
> & {
  onClose: () => void;
  titleId: string;
};

export function TerminalPtySettingsPopover({
  onClose,
  titleId,
  ...settingsBodyProps
}: TerminalPtySettingsPopoverProps) {
  return (
    <div
      aria-labelledby={titleId}
      className="terminal-settings-popover"
      role="dialog"
    >
      <div className="terminal-settings-popover-header">
        <span id={titleId}>Terminal settings</span>
        <Button
          aria-label="Close terminal settings"
          className="terminal-icon-button"
          onClick={onClose}
          title="Close settings"
          variant="ghost"
        >
          x
        </Button>
      </div>
      <TerminalPtySettingsBody {...settingsBodyProps} />
    </div>
  );
}
