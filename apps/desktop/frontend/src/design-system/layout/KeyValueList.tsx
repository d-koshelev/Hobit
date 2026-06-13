import type { ReactNode } from "react";

import { MetaRow } from "./MetaRow";

type KeyValueItem = {
  readonly label: ReactNode;
  readonly value: ReactNode;
};

type KeyValueListProps = {
  readonly compact?: boolean;
  readonly items: readonly KeyValueItem[];
};

export function KeyValueList({ compact = false, items }: KeyValueListProps) {
  return (
    <div className={["ui-key-value-list", compact ? "ui-key-value-list-compact" : ""].filter(Boolean).join(" ")}>
      {items.map((item, index) => (
        <MetaRow
          key={index}
          label={item.label}
          value={item.value}
          compact={compact}
        />
      ))}
    </div>
  );
}
