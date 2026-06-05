import { describe, expect, it } from "vitest";

import { formatNoteBody } from "./notesFormatters";

describe("notes formatters", () => {
  it("pretty prints and minifies valid JSON", () => {
    expect(formatNoteBody("pretty-json", '{"b":2,"a":[1]}')).toEqual({
      ok: true,
      value: '{\n  "b": 2,\n  "a": [\n    1\n  ]\n}',
    });
    expect(formatNoteBody("minify-json", '{ "b": 2, "a": [1] }')).toEqual({
      ok: true,
      value: '{"b":2,"a":[1]}',
    });
  });

  it("rejects invalid JSON without returning replacement text", () => {
    expect(formatNoteBody("pretty-json", "{ bad json")).toEqual({
      error: "Invalid JSON. Note body was not changed.",
      ok: false,
    });
  });

  it("normalizes CSV line endings and escaped quoted fields", () => {
    expect(
      formatNoteBody("normalize-csv", 'name,note\r\nAda,"said ""hi"""\r\n'),
    ).toEqual({
      ok: true,
      value: 'name,note\nAda,"said ""hi"""',
    });
  });

  it("rejects malformed CSV without returning replacement text", () => {
    expect(formatNoteBody("normalize-csv", 'name,note\nAda,"open')).toEqual({
      error: "Invalid CSV. A quoted field is not closed.",
      ok: false,
    });
  });

  it("normalizes plain text whitespace conservatively", () => {
    expect(formatNoteBody("normalize-text", "\r\nAlpha  \n\n\nBeta\t\n")).toEqual({
      ok: true,
      value: "Alpha\n\nBeta",
    });
  });
});
