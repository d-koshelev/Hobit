package com.hobit.jdbc;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class JdbcReadOnlySidecar {
    private static final int PROTOCOL_VERSION = 1;
    private static final int DEFAULT_ROW_LIMIT = 100;
    private static final int MAX_ROW_LIMIT = 100;
    private static final int DEFAULT_MAX_COLUMNS = 50;
    private static final int MAX_COLUMNS = 50;
    private static final int DEFAULT_MAX_CELL_CHARS = 2_000;
    private static final int MAX_CELL_CHARS = 2_000;
    private static final int DEFAULT_MAX_RESULT_BYTES = 256 * 1024;
    private static final int MAX_RESULT_BYTES = 256 * 1024;

    private JdbcReadOnlySidecar() {
    }

    public static void main(String[] args) throws Exception {
        String input = readStdin();
        Map<String, Object> request;
        try {
            request = new JsonParser(input).parseObject();
        } catch (RuntimeException error) {
            System.out.print(errorResponse("", "execution_failed", "JDBC sidecar request was invalid JSON.", false));
            return;
        }

        System.out.print(handle(request));
    }

    private static String handle(Map<String, Object> request) {
        String requestId = stringValue(request.get("request_id"), "");
        String runtimeKind = stringValue(request.get("runtime_kind"), "");
        String connectorId = stringValue(request.get("connector_id"), requestId);
        String driverKind = stringValue(request.get("driver_kind"), "");
        String statementKind = stringValue(request.get("statement_kind"), "read-only");
        boolean validatedReadOnly = booleanValue(request.get("validated_read_only"), false);

        if (!validatedReadOnly) {
            return errorResponse(requestId, "query_rejected", "SQL did not pass the read-only validator.", false);
        }

        if (!"mock_read_only".equals(runtimeKind)) {
            return errorResponse(requestId, "not_configured", "JDBC sidecar real runtime is not configured.", false);
        }

        if (!"jdbc".equals(driverKind) && !"generic_jdbc".equals(driverKind)) {
            return errorResponse(requestId, "unsupported_driver", "JDBC connector driver is not supported by the sidecar scaffold.", false);
        }

        int rowLimit = boundedInt(request.get("row_limit"), DEFAULT_ROW_LIMIT, 1, MAX_ROW_LIMIT);
        int maxColumns = boundedInt(request.get("max_columns"), DEFAULT_MAX_COLUMNS, 1, MAX_COLUMNS);
        int maxCellChars = boundedInt(request.get("max_cell_chars"), DEFAULT_MAX_CELL_CHARS, 1, MAX_CELL_CHARS);
        int maxResultBytes = boundedInt(request.get("max_result_bytes"), DEFAULT_MAX_RESULT_BYTES, 1, MAX_RESULT_BYTES);

        List<Column> columns = new ArrayList<>();
        columns.add(new Column("sample_index", "text"));
        columns.add(new Column("statement_kind", "text"));
        columns.add(new Column("connector_id", "text"));
        columns.add(new Column("runtime_note", "text"));

        List<List<String>> rows = new ArrayList<>();
        rows.add(row("1", statementKind, connectorId, "Validated read-only SQL reached the Java sidecar scaffold."));
        rows.add(row("2", statementKind, driverKind, "Deterministic Java sidecar mock sample."));
        rows.add(row("3", statementKind, runtimeKind, "No JDBC driver, credential, network, or database connection was used."));

        boolean truncatedRows = false;
        boolean truncatedColumns = false;
        boolean truncatedCells = false;
        boolean truncatedBytes = false;

        if (rows.size() > rowLimit) {
            rows = new ArrayList<>(rows.subList(0, rowLimit));
            truncatedRows = true;
        }

        if (columns.size() > maxColumns) {
            columns = new ArrayList<>(columns.subList(0, maxColumns));
            for (int index = 0; index < rows.size(); index += 1) {
                rows.set(index, new ArrayList<>(rows.get(index).subList(0, maxColumns)));
            }
            truncatedColumns = true;
        }

        for (List<String> row : rows) {
            for (int index = 0; index < row.size(); index += 1) {
                String capped = capString(row.get(index), maxCellChars);
                if (!capped.equals(row.get(index))) {
                    row.set(index, capped);
                    truncatedCells = true;
                }
            }
        }

        while (resultSizeBytes(columns, rows) > maxResultBytes && !rows.isEmpty()) {
            rows.remove(rows.size() - 1);
            truncatedRows = true;
            truncatedBytes = true;
        }

        StringBuilder json = new StringBuilder();
        json.append('{');
        field(json, "protocol_version", PROTOCOL_VERSION).append(',');
        field(json, "request_id", requestId).append(',');
        field(json, "status", "completed").append(',');
        json.append("\"columns\":").append(columnsJson(columns)).append(',');
        json.append("\"rows\":").append(rowsJson(rows)).append(',');
        field(json, "row_count", 3).append(',');
        field(json, "returned_row_count", rows.size()).append(',');
        field(json, "truncated", truncatedRows || truncatedColumns || truncatedCells || truncatedBytes).append(',');
        field(json, "truncated_rows", truncatedRows).append(',');
        field(json, "truncated_columns", truncatedColumns).append(',');
        field(json, "truncated_cells", truncatedCells).append(',');
        field(json, "truncated_bytes", truncatedBytes).append(',');
        field(json, "duration_ms", 0).append(',');
        json.append("\"sanitized_error\":null,");
        field(json, "no_secrets_returned", true).append(',');
        field(json, "no_ai_context_shared", true).append(',');
        field(json, "mock_execution", true);
        json.append('}');
        return json.toString();
    }

    private static String errorResponse(String requestId, String status, String message, boolean mockExecution) {
        StringBuilder json = new StringBuilder();
        json.append('{');
        field(json, "protocol_version", PROTOCOL_VERSION).append(',');
        field(json, "request_id", requestId).append(',');
        field(json, "status", status).append(',');
        json.append("\"columns\":[],\"rows\":[],");
        field(json, "row_count", 0).append(',');
        field(json, "returned_row_count", 0).append(',');
        field(json, "truncated", false).append(',');
        field(json, "truncated_rows", false).append(',');
        field(json, "truncated_columns", false).append(',');
        field(json, "truncated_cells", false).append(',');
        field(json, "truncated_bytes", false).append(',');
        field(json, "duration_ms", 0).append(',');
        field(json, "sanitized_error", sanitizeError(message)).append(',');
        field(json, "no_secrets_returned", true).append(',');
        field(json, "no_ai_context_shared", true).append(',');
        field(json, "mock_execution", mockExecution);
        json.append('}');
        return json.toString();
    }

    private static List<String> row(String first, String second, String third, String fourth) {
        List<String> row = new ArrayList<>();
        row.add(first);
        row.add(second);
        row.add(third);
        row.add(fourth);
        return row;
    }

    private static String readStdin() throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = System.in.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String sanitizeError(String message) {
        return capString(message.replace('\r', ' ').replace('\n', ' ').replaceAll("\\s+", " ").trim(), 240);
    }

    private static String capString(String value, int maxChars) {
        if (value.length() <= maxChars) {
            return value;
        }
        return value.substring(0, maxChars);
    }

    private static int boundedInt(Object value, int defaultValue, int minimum, int maximum) {
        if (!(value instanceof Number)) {
            return defaultValue;
        }
        int intValue = ((Number) value).intValue();
        return Math.max(minimum, Math.min(maximum, intValue));
    }

    private static String stringValue(Object value, String defaultValue) {
        return value instanceof String ? (String) value : defaultValue;
    }

    private static boolean booleanValue(Object value, boolean defaultValue) {
        return value instanceof Boolean ? (Boolean) value : defaultValue;
    }

    private static int resultSizeBytes(List<Column> columns, List<List<String>> rows) {
        int bytes = 0;
        for (Column column : columns) {
            bytes += column.name.length() + column.valueKind.length();
        }
        for (List<String> row : rows) {
            for (String cell : row) {
                bytes += cell.length();
            }
        }
        return bytes;
    }

    private static String columnsJson(List<Column> columns) {
        StringBuilder json = new StringBuilder("[");
        for (int index = 0; index < columns.size(); index += 1) {
            if (index > 0) {
                json.append(',');
            }
            json.append('{');
            field(json, "name", columns.get(index).name).append(',');
            field(json, "value_kind", columns.get(index).valueKind);
            json.append('}');
        }
        return json.append(']').toString();
    }

    private static String rowsJson(List<List<String>> rows) {
        StringBuilder json = new StringBuilder("[");
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex += 1) {
            if (rowIndex > 0) {
                json.append(',');
            }
            json.append('[');
            List<String> row = rows.get(rowIndex);
            for (int columnIndex = 0; columnIndex < row.size(); columnIndex += 1) {
                if (columnIndex > 0) {
                    json.append(',');
                }
                json.append(quote(row.get(columnIndex)));
            }
            json.append(']');
        }
        return json.append(']').toString();
    }

    private static StringBuilder field(StringBuilder json, String name, String value) {
        return json.append(quote(name)).append(':').append(quote(value));
    }

    private static StringBuilder field(StringBuilder json, String name, int value) {
        return json.append(quote(name)).append(':').append(value);
    }

    private static StringBuilder field(StringBuilder json, String name, boolean value) {
        return json.append(quote(name)).append(':').append(value);
    }

    private static String quote(String value) {
        StringBuilder json = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index += 1) {
            char current = value.charAt(index);
            switch (current) {
                case '"':
                    json.append("\\\"");
                    break;
                case '\\':
                    json.append("\\\\");
                    break;
                case '\n':
                    json.append("\\n");
                    break;
                case '\r':
                    json.append("\\r");
                    break;
                case '\t':
                    json.append("\\t");
                    break;
                default:
                    if (current < 0x20) {
                        json.append(String.format("\\u%04x", (int) current));
                    } else {
                        json.append(current);
                    }
            }
        }
        return json.append('"').toString();
    }

    private static final class Column {
        private final String name;
        private final String valueKind;

        private Column(String name, String valueKind) {
            this.name = name;
            this.valueKind = valueKind;
        }
    }

    private static final class JsonParser {
        private final String input;
        private int index;

        private JsonParser(String input) {
            this.input = input;
        }

        private Map<String, Object> parseObject() {
            skipWhitespace();
            expect('{');
            Map<String, Object> values = new LinkedHashMap<>();
            skipWhitespace();
            if (peek('}')) {
                index += 1;
                return values;
            }
            while (true) {
                String key = parseString();
                skipWhitespace();
                expect(':');
                Object value = parseValue();
                values.put(key, value);
                skipWhitespace();
                if (peek('}')) {
                    index += 1;
                    return values;
                }
                expect(',');
            }
        }

        private Object parseValue() {
            skipWhitespace();
            if (peek('"')) {
                return parseString();
            }
            if (peek('{')) {
                return parseObject();
            }
            if (startsWith("true")) {
                index += 4;
                return Boolean.TRUE;
            }
            if (startsWith("false")) {
                index += 5;
                return Boolean.FALSE;
            }
            if (startsWith("null")) {
                index += 4;
                return null;
            }
            return parseNumber();
        }

        private String parseString() {
            expect('"');
            StringBuilder value = new StringBuilder();
            while (index < input.length()) {
                char current = input.charAt(index++);
                if (current == '"') {
                    return value.toString();
                }
                if (current != '\\') {
                    value.append(current);
                    continue;
                }
                if (index >= input.length()) {
                    throw new IllegalArgumentException("unterminated escape");
                }
                char escaped = input.charAt(index++);
                switch (escaped) {
                    case '"':
                    case '\\':
                    case '/':
                        value.append(escaped);
                        break;
                    case 'n':
                        value.append('\n');
                        break;
                    case 'r':
                        value.append('\r');
                        break;
                    case 't':
                        value.append('\t');
                        break;
                    default:
                        throw new IllegalArgumentException("unsupported escape");
                }
            }
            throw new IllegalArgumentException("unterminated string");
        }

        private Number parseNumber() {
            int start = index;
            if (peek('-')) {
                index += 1;
            }
            while (index < input.length() && Character.isDigit(input.charAt(index))) {
                index += 1;
            }
            if (start == index) {
                throw new IllegalArgumentException("expected value");
            }
            return Integer.parseInt(input.substring(start, index));
        }

        private void expect(char expected) {
            skipWhitespace();
            if (index >= input.length() || input.charAt(index) != expected) {
                throw new IllegalArgumentException("expected " + expected);
            }
            index += 1;
        }

        private boolean peek(char expected) {
            return index < input.length() && input.charAt(index) == expected;
        }

        private boolean startsWith(String value) {
            return input.startsWith(value, index);
        }

        private void skipWhitespace() {
            while (index < input.length() && Character.isWhitespace(input.charAt(index))) {
                index += 1;
            }
        }
    }
}
