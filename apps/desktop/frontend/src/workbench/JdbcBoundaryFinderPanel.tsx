import { useEffect, useId, useMemo, useState } from "react";
import {
  JDBC_BOUNDARY_FINDER_SAMPLE_PRESETS,
  errorToMessage,
  renderJdbcBoundarySql,
  validateJdbcBoundaryPreset,
  type JdbcBoundaryFilterDefinition,
  type JdbcBoundaryFilterValues,
  type JdbcBoundaryPreset,
} from "./jdbcConnectorWidgetModel";

type JdbcBoundaryFinderPanelProps = {
  presets?: JdbcBoundaryPreset[];
};

export function JdbcBoundaryFinderPanel({
  presets = JDBC_BOUNDARY_FINDER_SAMPLE_PRESETS,
}: JdbcBoundaryFinderPanelProps) {
  const presetInputId = useId();
  const rangeMinInputId = useId();
  const rangeMaxInputId = useId();
  const precisionInputId = useId();
  const probeValueInputId = useId();
  const [selectedPresetId, setSelectedPresetId] = useState(
    presets[0]?.presetId ?? "",
  );
  const selectedPreset = useMemo(
    () =>
      presets.find((preset) => preset.presetId === selectedPresetId) ??
      presets[0] ??
      null,
    [presets, selectedPresetId],
  );
  const [filterDrafts, setFilterDrafts] = useState<Record<string, string>>(() =>
    selectedPreset ? defaultBoundaryFilterDrafts(selectedPreset) : {},
  );
  const [rangeMin, setRangeMin] = useState(() =>
    selectedPreset?.range.min.toString() ?? "0",
  );
  const [rangeMax, setRangeMax] = useState(() =>
    selectedPreset?.range.max.toString() ?? "100",
  );
  const [precision, setPrecision] = useState(() =>
    selectedPreset?.range.precision.toString() ?? "1",
  );
  const [probeValue, setProbeValue] = useState(() =>
    selectedPreset
      ? String((selectedPreset.range.min + selectedPreset.range.max) / 2)
      : "50",
  );

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }

    setFilterDrafts(defaultBoundaryFilterDrafts(selectedPreset));
    setRangeMin(selectedPreset.range.min.toString());
    setRangeMax(selectedPreset.range.max.toString());
    setPrecision(selectedPreset.range.precision.toString());
    setProbeValue(
      String((selectedPreset.range.min + selectedPreset.range.max) / 2),
    );
  }, [selectedPreset]);

  if (!selectedPreset) {
    return (
      <section aria-label="Boundary Finder" className="jdbc-boundary-panel">
        <div className="jdbc-sql-header">
          <div>
            <p className="jdbc-pane-title">Boundary Finder</p>
            <p className="jdbc-pane-subtitle">
              No Boundary Finder presets are available in this frontend build.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const preview = boundaryPreview({
    filterDrafts,
    precision,
    probeValue,
    rangeMax,
    rangeMin,
    selectedPreset,
  });
  const validationErrors = [
    ...preview.presetValidation.errors,
    ...(preview.previewError ? [preview.previewError] : []),
  ];

  function updateFilterValue(key: string, value: string) {
    setFilterDrafts((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <section aria-label="Boundary Finder" className="jdbc-boundary-panel">
      <div className="jdbc-sql-header">
        <div>
          <p className="jdbc-pane-title">Boundary Finder</p>
          <p className="jdbc-pane-subtitle">
            Preset-driven SQL preview for typed filters and a sample probe
            value. Boundary execution is not wired in this block.
          </p>
        </div>
      </div>

      <div className="jdbc-boundary-grid">
        <label className="jdbc-field jdbc-field-wide" htmlFor={presetInputId}>
          <span className="field-label">Boundary Finder preset</span>
          <select
            className="select"
            id={presetInputId}
            onChange={(event) => setSelectedPresetId(event.currentTarget.value)}
            value={selectedPreset.presetId}
          >
            {presets.map((preset) => (
              <option key={preset.presetId} value={preset.presetId}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <div className="jdbc-boundary-description jdbc-field-wide">
          <span className="jdbc-runtime-label">Preset description</span>
          <span className="jdbc-runtime-value">
            {selectedPreset.description ??
              "Preview-only Boundary Finder preset."}
          </span>
        </div>

        {selectedPreset.filters.map((filter) => (
          <JdbcBoundaryFilterInput
            filter={filter}
            key={filter.key}
            onChange={(value) => updateFilterValue(filter.key, value)}
            value={filterDrafts[filter.key] ?? ""}
          />
        ))}

        <label className="jdbc-field" htmlFor={rangeMinInputId}>
          <span className="field-label">Range min</span>
          <input
            className="input"
            id={rangeMinInputId}
            onChange={(event) => setRangeMin(event.currentTarget.value)}
            type="number"
            value={rangeMin}
          />
        </label>
        <label className="jdbc-field" htmlFor={rangeMaxInputId}>
          <span className="field-label">Range max</span>
          <input
            className="input"
            id={rangeMaxInputId}
            onChange={(event) => setRangeMax(event.currentTarget.value)}
            type="number"
            value={rangeMax}
          />
        </label>
        <label className="jdbc-field" htmlFor={precisionInputId}>
          <span className="field-label">Precision</span>
          <input
            className="input"
            id={precisionInputId}
            min="0"
            onChange={(event) => setPrecision(event.currentTarget.value)}
            type="number"
            value={precision}
          />
        </label>
        <label className="jdbc-field" htmlFor={probeValueInputId}>
          <span className="field-label">Sample probe value</span>
          <input
            className="input"
            id={probeValueInputId}
            onChange={(event) => setProbeValue(event.currentTarget.value)}
            type="number"
            value={probeValue}
          />
        </label>
      </div>

      {validationErrors.length > 0 ? (
        <div
          aria-label="Boundary Finder validation errors"
          className="jdbc-message jdbc-message-error"
          role="alert"
        >
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : (
        <p className="jdbc-message jdbc-message-warning">
          SQL preview only. No Boundary Finder probes, JDBC queries, sidecar
          calls, Queue tasks, Agent Executor runs, or Workspace Agent actions
          are started from this section.
        </p>
      )}

      <div className="jdbc-boundary-preview">
        <div className="jdbc-result-toolbar">
          <div>
            <p className="jdbc-empty-title">Rendered SQL preview</p>
            <p className="jdbc-empty-text">
              Values are rendered as typed literals through the safe Boundary
              Finder template renderer.
            </p>
          </div>
        </div>
        <pre aria-label="Boundary Finder SQL preview">
          {preview.sql ?? "Fix validation errors to render the SQL preview."}
        </pre>
      </div>
    </section>
  );
}

function JdbcBoundaryFilterInput({
  filter,
  onChange,
  value,
}: {
  filter: JdbcBoundaryFilterDefinition;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputId = useId();
  const label = `${filter.label}${filter.required ? " required" : ""}`;

  if (filter.type === "boolean") {
    return (
      <label className="jdbc-field" htmlFor={inputId}>
        <span className="field-label">{label}</span>
        <select
          className="select"
          id={inputId}
          onChange={(event) => onChange(event.currentTarget.value)}
          value={value}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <span className="jdbc-query-hint">{boundaryFilterHint(filter)}</span>
      </label>
    );
  }

  return (
    <label className="jdbc-field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input
        className="input"
        id={inputId}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={boundaryFilterPlaceholder(filter)}
        type={boundaryFilterInputType(filter)}
        value={value}
      />
      <span className="jdbc-query-hint">{boundaryFilterHint(filter)}</span>
    </label>
  );
}

function boundaryPreview({
  filterDrafts,
  precision,
  probeValue,
  rangeMax,
  rangeMin,
  selectedPreset,
}: {
  filterDrafts: Record<string, string>;
  precision: string;
  probeValue: string;
  rangeMax: string;
  rangeMin: string;
  selectedPreset: JdbcBoundaryPreset;
}) {
  const presetWithRange: JdbcBoundaryPreset = {
    ...selectedPreset,
    range: {
      ...selectedPreset.range,
      max: parseBoundaryNumber(rangeMax),
      min: parseBoundaryNumber(rangeMin),
      precision: parseBoundaryNumber(precision),
    },
  };
  const presetValidation = validateJdbcBoundaryPreset(presetWithRange);
  const parsedProbeValue = parseBoundaryNumber(probeValue);

  if (!Number.isFinite(parsedProbeValue)) {
    return {
      presetValidation,
      previewError: "Boundary probe value must be a finite number.",
      sql: null,
    };
  }

  if (!presetValidation.isValid) {
    return {
      presetValidation,
      previewError: null,
      sql: null,
    };
  }

  try {
    return {
      presetValidation,
      previewError: null,
      sql: renderJdbcBoundarySql(
        presetWithRange,
        parseBoundaryFilterDrafts(selectedPreset.filters, filterDrafts),
        parsedProbeValue,
      ),
    };
  } catch (error) {
    return {
      presetValidation,
      previewError: errorToMessage(
        error,
        "Unable to render Boundary Finder SQL.",
      ),
      sql: null,
    };
  }
}

function parseBoundaryFilterDrafts(
  filters: JdbcBoundaryFilterDefinition[],
  drafts: Record<string, string>,
): JdbcBoundaryFilterValues {
  const values: JdbcBoundaryFilterValues = {};

  for (const filter of filters) {
    const draft = drafts[filter.key] ?? "";

    if (filter.type === "boolean") {
      values[filter.key] = draft === "true";
    } else if (filter.type === "stringList" || filter.type === "integerList") {
      values[filter.key] = draft
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      values[filter.key] = draft;
    }
  }

  return values;
}

function defaultBoundaryFilterDrafts(preset: JdbcBoundaryPreset) {
  return Object.fromEntries(
    preset.filters.map((filter) => [
      filter.key,
      defaultBoundaryFilterValue(filter),
    ]),
  );
}

function defaultBoundaryFilterValue(filter: JdbcBoundaryFilterDefinition) {
  switch (filter.type) {
    case "boolean":
      return "true";
    case "date":
      return "2026-05-01";
    case "decimal":
      return "10.5";
    case "integer":
      return "1";
    case "integerList":
      return "1, 2";
    case "stringList":
      return "ready, reviewed";
    case "timestamp":
      return "2026-05-29T10:30:00Z";
    case "string":
    default:
      return "sample_value";
  }
}

function boundaryFilterInputType(filter: JdbcBoundaryFilterDefinition) {
  if (filter.type === "date") {
    return "date";
  }

  if (filter.type === "decimal" || filter.type === "integer") {
    return "number";
  }

  return "text";
}

function boundaryFilterPlaceholder(filter: JdbcBoundaryFilterDefinition) {
  switch (filter.type) {
    case "date":
      return "2026-05-01";
    case "decimal":
      return "10.5";
    case "integer":
      return "1";
    case "integerList":
      return "1, 2";
    case "stringList":
      return "ready, reviewed";
    case "timestamp":
      return "2026-05-29T10:30:00Z";
    case "string":
    default:
      return "sample_value";
  }
}

function boundaryFilterHint(filter: JdbcBoundaryFilterDefinition) {
  const typeLabel =
    filter.type === "stringList" || filter.type === "integerList"
      ? `${filter.type}; comma-separated`
      : filter.type;

  return filter.description
    ? `${typeLabel}. ${filter.description}`
    : typeLabel;
}

function parseBoundaryNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}
