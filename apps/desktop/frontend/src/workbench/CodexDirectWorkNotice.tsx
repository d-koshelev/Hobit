type CodexDirectWorkNoticeProps = {
  title: string;
  message: string;
  variant: "info" | "error";
};

export function CodexDirectWorkNotice({
  title,
  message,
  variant,
}: CodexDirectWorkNoticeProps) {
  return (
    <div
      aria-live="polite"
      className={`codex-direct-work-notice codex-direct-work-notice-${variant}`}
      role="status"
    >
      <p className="codex-direct-work-notice-title">{title}</p>
      <p className="codex-direct-work-notice-text">{message}</p>
    </div>
  );
}
