type EmptyStateProps = {
  text: string;
  title: string;
};

export function EmptyState({ text, title }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-text">{text}</p>
    </div>
  );
}
