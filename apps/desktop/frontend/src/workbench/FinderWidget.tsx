import { useState } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { WidgetFrame } from "../design-system/WidgetFrame";
import type { WidgetRenderProps } from "./types";

const MAX_DIRECTORY_ENTRIES = 200;

type FinderEntryKind = "directory" | "file";

type FinderFileHandle = {
  kind: "file";
  name: string;
};

type FinderDirectoryHandle = {
  entries?: () => AsyncIterableIterator<[string, FinderHandle]>;
  kind: "directory";
  name: string;
  values?: () => AsyncIterableIterator<FinderHandle>;
};

type FinderHandle = FinderDirectoryHandle | FinderFileHandle;

type FinderEntry = {
  handle: FinderHandle;
  kind: FinderEntryKind;
  name: string;
  pathSegments: string[];
};

type FinderColumn = {
  capped: boolean;
  entries: FinderEntry[];
  error: string | null;
  handle: FinderDirectoryHandle;
  loading: boolean;
  pathSegments: string[];
};

type FinderSelectedItem = {
  kind: FinderEntryKind;
  name: string;
  pathSegments: string[];
};

type FinderRootState = {
  handle: FinderDirectoryHandle | null;
  label: string;
  listingAvailable: boolean;
};

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FinderDirectoryHandle>;
  }
}

export function FinderWidget({
  frameActions,
  frameMoveEnabled,
  frameStyle,
  instance,
  logRefreshToken,
  onLoadLogs,
  onSelectWorkspaceDirectory,
  onStartFrameMove,
  title,
}: WidgetRenderProps) {
  const [columns, setColumns] = useState<FinderColumn[]>([]);
  const [root, setRoot] = useState<FinderRootState | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [isOpeningRoot, setIsOpeningRoot] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinderSelectedItem | null>(
    null,
  );

  const selectedPath = selectedItem
    ? selectedItem.pathSegments.join("/")
    : root?.label ?? "No root selected";
  const canUseDirectoryPicker =
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function";

  async function openRoot() {
    if (isOpeningRoot) {
      return;
    }

    setRootError(null);
    setIsOpeningRoot(true);
    setSelectedItem(null);

    try {
      if (canUseDirectoryPicker && window.showDirectoryPicker) {
        const directoryHandle = await window.showDirectoryPicker();
        const rootLabel = directoryHandle.name || "Selected root";
        setRoot({
          handle: directoryHandle,
          label: rootLabel,
          listingAvailable: true,
        });
        setColumns([
          {
            capped: false,
            entries: [],
            error: null,
            handle: directoryHandle,
            loading: true,
            pathSegments: [],
          },
        ]);
        await loadColumn(directoryHandle, [], 0);
        return;
      }

      if (onSelectWorkspaceDirectory) {
        const selectedDirectory = await onSelectWorkspaceDirectory();
        if (selectedDirectory) {
          setRoot({
            handle: null,
            label: selectedDirectory,
            listingAvailable: false,
          });
          setColumns([]);
          setRootError(
            "Directory listing is unavailable in this frontend runtime.",
          );
        }
        return;
      }

      setRootError("Directory picker is unavailable in this runtime.");
    } catch (error) {
      setColumns([]);
      setRoot(null);
      setRootError(`Open root failed: ${errorToReadableMessage(error)}`);
    } finally {
      setIsOpeningRoot(false);
    }
  }

  async function loadColumn(
    directoryHandle: FinderDirectoryHandle,
    pathSegments: string[],
    columnIndex: number,
  ) {
    try {
      const { capped, entries } = await readDirectoryEntries(
        directoryHandle,
        pathSegments,
      );

      setColumns((currentColumns) => {
        const nextColumns = currentColumns.slice(0, columnIndex + 1);
        nextColumns[columnIndex] = {
          capped,
          entries,
          error: null,
          handle: directoryHandle,
          loading: false,
          pathSegments,
        };
        return nextColumns;
      });
    } catch (error) {
      setColumns((currentColumns) => {
        const nextColumns = currentColumns.slice(0, columnIndex + 1);
        nextColumns[columnIndex] = {
          capped: false,
          entries: [],
          error: errorToReadableMessage(error),
          handle: directoryHandle,
          loading: false,
          pathSegments,
        };
        return nextColumns;
      });
    }
  }

  async function selectEntry(entry: FinderEntry, columnIndex: number) {
    setSelectedItem({
      kind: entry.kind,
      name: entry.name,
      pathSegments: entry.pathSegments,
    });

    if (entry.kind !== "directory") {
      setColumns((currentColumns) => currentColumns.slice(0, columnIndex + 1));
      return;
    }

    const directoryHandle = entry.handle as FinderDirectoryHandle;
    const nextColumnIndex = columnIndex + 1;
    setColumns((currentColumns) => [
      ...currentColumns.slice(0, nextColumnIndex),
      {
        capped: false,
        entries: [],
        error: null,
        handle: directoryHandle,
        loading: true,
        pathSegments: entry.pathSegments,
      },
    ]);
    await loadColumn(directoryHandle, entry.pathSegments, nextColumnIndex);
  }

  return (
    <WidgetFrame
      actions={frameActions}
      logRefreshToken={logRefreshToken}
      moveEnabled={frameMoveEnabled}
      onLoadLogs={onLoadLogs ? () => onLoadLogs(instance.id) : undefined}
      onMoveStart={onStartFrameMove}
      style={frameStyle}
      status={<Badge variant="info">Preview</Badge>}
      subtitle={root ? selectedPath : "Explicit root required"}
      title={title}
    >
      <div className="finder-widget">
        <section aria-label="Finder root scope" className="finder-scope">
          <div className="finder-scope-copy">
            <p className="finder-title">Workspace root</p>
            <p className="finder-text">
              {root
                ? root.label
                : "Choose a local root before listing files or folders."}
            </p>
          </div>
          <div className="finder-scope-actions">
            <Badge variant={root?.listingAvailable ? "success" : "neutral"}>
              {root?.listingAvailable ? "Root open" : "No root"}
            </Badge>
            <Button
              disabled={isOpeningRoot}
              onClick={() => void openRoot()}
              variant="secondary"
            >
              {isOpeningRoot ? "Opening" : "Open root"}
            </Button>
          </div>
        </section>

        {rootError ? (
          <section aria-label="Finder runtime status" className="finder-error">
            <p className="finder-title">Preview unavailable</p>
            <p className="finder-text">{rootError}</p>
          </section>
        ) : null}

        <div className="finder-layout">
          <section aria-label="Finder columns" className="finder-column-strip">
            {columns.length === 0 ? (
              <div className="finder-empty">
                <p className="finder-title">No columns yet.</p>
                <p className="finder-text">
                  The first column appears after an approved root can be listed.
                </p>
              </div>
            ) : (
              columns.map((column, columnIndex) => (
                <FinderColumnView
                  column={column}
                  key={column.pathSegments.join("/") || "root"}
                  onSelectEntry={(entry) =>
                    void selectEntry(entry, columnIndex)
                  }
                  selectedItem={selectedItem}
                />
              ))
            )}
          </section>

          <section aria-label="Finder selected file preview" className="finder-preview">
            <div className="finder-preview-header">
              <div className="finder-preview-copy">
                <p className="finder-title">Read-only preview</p>
                <p className="finder-text">
                  {selectedItem
                    ? selectedItem.pathSegments.join("/")
                    : "Select a file to prepare the preview hook."}
                </p>
              </div>
              <Badge variant="neutral">
                {selectedItem?.kind === "file" ? "Selected file" : "Placeholder"}
              </Badge>
            </div>
            {selectedItem?.kind === "file" ? (
              <div className="finder-preview-placeholder">
                <p className="finder-title">{selectedItem.name}</p>
                <p className="finder-text">
                  File content preview is intentionally not wired in this MVP.
                  This pane only tracks the selected path for a future bounded
                  read-only preview action.
                </p>
              </div>
            ) : (
              <div className="finder-preview-placeholder">
                <p className="finder-title">No file preview loaded.</p>
                <p className="finder-text">
                  Folder selection updates columns only. No file contents, Git
                  data, or hidden context are read.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </WidgetFrame>
  );
}

function FinderColumnView({
  column,
  onSelectEntry,
  selectedItem,
}: {
  column: FinderColumn;
  onSelectEntry: (entry: FinderEntry) => void;
  selectedItem: FinderSelectedItem | null;
}) {
  const columnLabel =
    column.pathSegments.length === 0
      ? "Root"
      : column.pathSegments[column.pathSegments.length - 1];

  return (
    <section className="finder-column" aria-label={`${columnLabel} entries`}>
      <header className="finder-column-header">
        <p className="finder-column-title">{columnLabel}</p>
        {column.capped ? <Badge variant="warning">Capped</Badge> : null}
      </header>
      {column.loading ? <p className="finder-column-state">Loading...</p> : null}
      {column.error ? (
        <p className="finder-column-state finder-column-error">{column.error}</p>
      ) : null}
      {!column.loading && !column.error && column.entries.length === 0 ? (
        <p className="finder-column-state">Empty folder.</p>
      ) : null}
      <div className="finder-entry-list" role="list">
        {column.entries.map((entry) => {
          const isSelected =
            selectedItem?.pathSegments.join("/") ===
            entry.pathSegments.join("/");

          return (
            <button
              aria-pressed={isSelected}
              className={[
                "finder-entry",
                isSelected ? "finder-entry-selected" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              key={`${entry.kind}:${entry.pathSegments.join("/")}`}
              onClick={() => onSelectEntry(entry)}
              type="button"
            >
              <span className="finder-entry-kind">
                {entry.kind === "directory" ? "Folder" : "File"}
              </span>
              <span className="finder-entry-name">{entry.name}</span>
              {entry.kind === "directory" ? (
                <span className="finder-entry-arrow" aria-hidden="true">
                  &gt;
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

async function readDirectoryEntries(
  directoryHandle: FinderDirectoryHandle,
  pathSegments: string[],
) {
  const handles: FinderHandle[] = [];
  let capped = false;

  for await (const handle of iterateDirectoryHandles(directoryHandle)) {
    handles.push(handle);
    if (handles.length > MAX_DIRECTORY_ENTRIES) {
      capped = true;
      handles.pop();
      break;
    }
  }

  const entries = handles
    .map((handle) => ({
      handle,
      kind: handle.kind,
      name: handle.name,
      pathSegments: [...pathSegments, handle.name],
    }))
    .sort(compareFinderEntries);

  return { capped, entries };
}

async function* iterateDirectoryHandles(directoryHandle: FinderDirectoryHandle) {
  if (directoryHandle.values) {
    for await (const handle of directoryHandle.values()) {
      yield handle;
    }
    return;
  }

  if (directoryHandle.entries) {
    for await (const [, handle] of directoryHandle.entries()) {
      yield handle;
    }
    return;
  }

  throw new Error("Directory entries are unavailable in this runtime.");
}

function compareFinderEntries(first: FinderEntry, second: FinderEntry) {
  if (first.kind !== second.kind) {
    return first.kind === "directory" ? -1 : 1;
  }

  return first.name.localeCompare(second.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function errorToReadableMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}
