import type { JdbcReadOnlyQueryResult } from "../workspace/jdbcQueryTypes";
import {
  redactJdbcText,
  valueKindClass,
} from "./jdbcQueryResultFormatters";

export function JdbcQueryResultTable({
  result,
}: {
  result: JdbcReadOnlyQueryResult;
}) {
  if (result.rows.length === 0) {
    return (
      <div className="jdbc-result-empty">
        <p className="jdbc-empty-title">No rows returned.</p>
        <p className="jdbc-empty-text">
          Query completed with a visible empty result.
        </p>
      </div>
    );
  }

  return (
    <div className="jdbc-result-table-wrap">
      <table className="jdbc-result-table">
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column.name} scope="col">
                <span>{column.name}</span>
                <span>{column.valueKind}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {result.columns.map((column, columnIndex) => (
                <td
                  className={`jdbc-result-cell jdbc-result-cell-${valueKindClass(column.valueKind)}`}
                  key={`${column.name}-${columnIndex.toString()}`}
                >
                  <JdbcResultCell value={row[columnIndex] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JdbcResultCell({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="jdbc-result-null">NULL</span>;
  }

  const displayValue = redactJdbcText(value);

  return (
    <span className="jdbc-result-cell-value" title={displayValue}>
      {displayValue}
    </span>
  );
}
