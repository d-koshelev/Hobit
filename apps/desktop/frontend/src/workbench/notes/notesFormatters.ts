export type NotesFormatAction =
  | "pretty-json"
  | "minify-json"
  | "normalize-csv"
  | "normalize-text";

export type NotesFormatResult =
  | {
      ok: true;
      value: string;
    }
  | {
      error: string;
      ok: false;
    };

type CsvParseResult =
  | {
      ok: true;
      rows: string[][];
    }
  | {
      error: string;
      ok: false;
    };

export function formatNoteBody(
  action: NotesFormatAction,
  body: string,
): NotesFormatResult {
  switch (action) {
    case "pretty-json":
      return formatJson(body, 2);
    case "minify-json":
      return formatJson(body, 0);
    case "normalize-csv":
      return normalizeCsv(body);
    case "normalize-text":
      return {
        ok: true,
        value: normalizePlainText(body),
      };
  }
}

function formatJson(body: string, spacing: number): NotesFormatResult {
  try {
    const parsed = JSON.parse(body) as unknown;
    const value = JSON.stringify(parsed, null, spacing);

    return {
      ok: true,
      value: value ?? "",
    };
  } catch {
    return {
      error: "Invalid JSON. Note body was not changed.",
      ok: false,
    };
  }
}

function normalizeCsv(body: string): NotesFormatResult {
  const parsed = parseCsv(body);

  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.rows.length === 0) {
    return {
      ok: true,
      value: "",
    };
  }

  const fieldCount = parsed.rows[0]?.length ?? 0;
  const hasRaggedRows = parsed.rows.some((row) => row.length !== fieldCount);

  if (hasRaggedRows) {
    return {
      error: "Invalid CSV. Rows must have the same number of fields.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: parsed.rows
      .map((row) => row.map(serializeCsvField).join(","))
      .join("\n"),
  };
}

function normalizePlainText(body: string) {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function serializeCsvField(field: string) {
  if (!/[",\n\r]/.test(field) && field.trim() === field) {
    return field;
  }

  return `"${field.replace(/"/g, '""')}"`;
}

function parseCsv(body: string): CsvParseResult {
  const input = body.replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteClosed = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (quoteClosed) {
      if (char === ",") {
        row.push(field);
        field = "";
        quoteClosed = false;
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        quoteClosed = false;
      } else if (char !== " " && char !== "\t") {
        return {
          error: "Invalid CSV. Unexpected text after a quoted field.",
          ok: false,
        };
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        return {
          error: "Invalid CSV. Quotes must wrap the whole field.",
          ok: false,
        };
      }
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    return {
      error: "Invalid CSV. A quoted field is not closed.",
      ok: false,
    };
  }

  row.push(field);
  rows.push(row);

  while (
    rows.length > 1 &&
    rows[rows.length - 1]?.length === 1 &&
    rows[rows.length - 1]?.[0] === ""
  ) {
    rows.pop();
  }

  return {
    ok: true,
    rows,
  };
}
