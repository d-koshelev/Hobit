export function formatDirectWorkClockTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function formatDirectWorkDuration(milliseconds: number) {
  if (milliseconds < 1000) {
    return `${Math.max(0, Math.round(milliseconds))}ms`;
  }

  if (milliseconds < 60000) {
    const seconds = milliseconds / 1000;
    const precision = seconds < 10 ? 2 : 1;
    return `${trimTrailingZeros(seconds.toFixed(precision))}s`;
  }

  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.round((milliseconds % 60000) / 1000);

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}
