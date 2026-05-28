import { Badge } from "../design-system/Badge";
import type { GitFileChange } from "../workspace/types";
import {
  gitChangedFileGroups,
  gitChangedFilePathLabel,
  gitChangeAreaLabel,
  gitChangeKindBadgeVariant,
  gitChangeKindLabel,
} from "./gitStatusViewModel";

type GitChangesPanelProps = {
  changedFiles: GitFileChange[] | null;
  onSelectFile: (path: string) => void;
  selectedFilePath: string | null;
};

export function GitChangesPanel({
  changedFiles,
  onSelectFile,
  selectedFilePath,
}: GitChangesPanelProps) {
  if (!changedFiles) {
    return (
      <GitEmptyState
        text="Enter a repo path and refresh."
        title="No repository loaded"
      />
    );
  }

  const groups = gitChangedFileGroups(changedFiles).filter(
    (group) => group.files.length > 0,
  );

  return (
    <section className="git-tab-panel" role="tabpanel">
      <div className="git-panel-header">
        <h3 className="git-panel-title">Changes</h3>
        <Badge variant={changedFiles.length > 0 ? "warning" : "success"}>
          {changedFiles.length} changed files
        </Badge>
      </div>
      {changedFiles.length === 0 ? (
        <GitEmptyState text="Working tree is clean." title="No local changes" />
      ) : (
        <div className="git-review-file-groups">
          {groups.map((group) => (
            <section className="git-review-file-group" key={group.key}>
              <div className="git-review-file-group-header">
                <h4 className="git-review-file-group-title">{group.title}</h4>
                <Badge variant={group.badgeVariant}>{group.files.length}</Badge>
              </div>
              <div className="git-review-file-list">
                {group.files.map((file, index) => (
                  <button
                    className={`git-review-file-row${
                      selectedFilePath === file.path
                        ? " git-review-file-row-selected"
                        : ""
                    }`}
                    key={`${file.area}-${file.kind}-${file.path}-${index}`}
                    onClick={() => onSelectFile(file.path)}
                    type="button"
                  >
                    <code className="git-review-file-path">
                      {gitChangedFilePathLabel(file)}
                    </code>
                    <span className="git-review-file-meta">
                      <Badge variant={gitChangeKindBadgeVariant(file.kind)}>
                        {gitChangeKindLabel(file.kind)}
                      </Badge>
                      <Badge variant="neutral">
                        {gitChangeAreaLabel(file.area)}
                      </Badge>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function GitEmptyState({
  text,
  title,
}: {
  text: string;
  title: string;
}) {
  return (
    <div className="git-empty-state git-empty-state-neutral">
      <p className="git-empty-title">{title}</p>
      <p className="git-empty-text">{text}</p>
    </div>
  );
}
