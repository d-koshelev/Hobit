package com.hobit.jdbc;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.sql.SQLInvalidAuthorizationSpecException;
import java.sql.SQLTimeoutException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;

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
        String requestKind = stringValue(request.get("request"), "executeReadOnlyQuery");
        String runtimeKind = stringValue(request.get("runtime_kind"), "");
        String connectorId = stringValue(request.get("connector_id"), requestId);
        String driverKind = stringValue(request.get("driver_kind"), "");
        String statementKind = stringValue(request.get("statement_kind"), "read-only");
        boolean validatedReadOnly = booleanValue(request.get("validated_read_only"), false);
        String sql = stringValue(request.get("sql"), "");

        if ("healthCheck".equals(requestKind) || "health_check".equals(requestKind)) {
            return healthCheckResponse(requestId);
        }

        if ("driverProbe".equals(requestKind) || "driver_probe".equals(requestKind)) {
            return driverProbeResponse(requestId, request);
        }

        if (!validatedReadOnly) {
            return errorResponse(requestId, "query_rejected", "SQL did not pass the read-only validator.", false);
        }

        if (!"mock_read_only".equals(runtimeKind) && !"real_jdbc".equals(runtimeKind)) {
            return errorResponse(requestId, "not_configured", "JDBC sidecar real runtime is not configured.", false);
        }

        if (!"jdbc".equals(driverKind) && !"generic_jdbc".equals(driverKind)) {
            return errorResponse(requestId, "unsupported_driver", "JDBC connector driver is not supported by the sidecar scaffold.", false);
        }

        int rowLimit = boundedInt(request.get("row_limit"), DEFAULT_ROW_LIMIT, 1, MAX_ROW_LIMIT);
        int maxColumns = boundedInt(request.get("max_columns"), DEFAULT_MAX_COLUMNS, 1, MAX_COLUMNS);
        int maxCellChars = boundedInt(request.get("max_cell_chars"), DEFAULT_MAX_CELL_CHARS, 1, MAX_CELL_CHARS);
        int maxResultBytes = boundedInt(request.get("max_result_bytes"), DEFAULT_MAX_RESULT_BYTES, 1, MAX_RESULT_BYTES);

        if ("real_jdbc".equals(runtimeKind)) {
            return executeRealJdbc(request, requestId, sql, rowLimit, maxColumns, maxCellChars, maxResultBytes);
        }

        List<Column> columns = new ArrayList<>();
        columns.add(new Column("sample_index", "text"));
        columns.add(new Column("statement_kind", "text"));
        columns.add(new Column("connector_id", "text"));
        columns.add(new Column("runtime_note", "text"));

        List<List<String>> rows = new ArrayList<>();
        rows.add(row("1", statementKind, connectorId, "Validated read-only SQL reached the Java sidecar scaffold."));
        rows.add(row("2", statementKind, driverKind, "Deterministic Java sidecar mock sample."));
        rows.add(row("3", statementKind, runtimeKind, "No JDBC driver, credential, network, or database connection was used."));

        return completedResponse(requestId, columns, rows, 3, rowLimit, maxColumns, maxCellChars, maxResultBytes, 0, true);
    }

    private static String healthCheckResponse(String requestId) {
        List<Column> columns = new ArrayList<>();
        columns.add(new Column("check", "text"));
        columns.add(new Column("value", "text"));
        List<List<String>> rows = new ArrayList<>();
        rows.add(row("sidecar", "healthy"));
        rows.add(row("protocol_version", String.valueOf(PROTOCOL_VERSION)));
        return completedResponse(requestId, columns, rows, rows.size(), DEFAULT_ROW_LIMIT, MAX_COLUMNS, MAX_CELL_CHARS, MAX_RESULT_BYTES, 0, false);
    }

    private static String driverProbeResponse(String requestId, Map<String, Object> request) {
        String driverJarPath = stringValue(request.get("driver_jar_path"), "");
        String driverClassName = stringValue(request.get("driver_class_name"), "");
        try {
            loadDriver(driverJarPath, driverClassName);
            List<Column> columns = new ArrayList<>();
            columns.add(new Column("check", "text"));
            columns.add(new Column("value", "text"));
            List<List<String>> rows = new ArrayList<>();
            rows.add(row("driver", "loaded"));
            return completedResponse(requestId, columns, rows, rows.size(), DEFAULT_ROW_LIMIT, MAX_COLUMNS, MAX_CELL_CHARS, MAX_RESULT_BYTES, 0, false);
        } catch (SidecarFailure failure) {
            return errorResponse(requestId, failure.status, failure.getMessage(), false);
        }
    }

    private static String executeRealJdbc(Map<String, Object> request, String requestId, String sql, int rowLimit, int maxColumns, int maxCellChars, int maxResultBytes) {
        if (!isSidecarReadOnlySql(sql)) {
            return errorResponse(requestId, "query_rejected", "Experimental JDBC sidecar accepts only SELECT or WITH single statements.", false);
        }

        long startedAt = System.nanoTime();
        String driverJarPath = stringValue(request.get("driver_jar_path"), "");
        String driverClassName = stringValue(request.get("driver_class_name"), "");
        String jdbcUrl = stringValue(request.get("jdbc_url"), "");
        String username = stringValue(request.get("username"), "");
        String credentialEnvVarName = stringValue(request.get("credential_env_var_name"), "");
        int timeoutMs = boundedInt(request.get("timeout_ms"), 10_000, 1, 10_000);

        if (jdbcUrl.isEmpty()) {
            return errorResponse(requestId, "not_configured", "JDBC URL is required for experimental sidecar execution.", false);
        }

        try {
            loadDriver(driverJarPath, driverClassName);
        } catch (SidecarFailure failure) {
            return errorResponse(requestId, failure.status, failure.getMessage(), false);
        }

        Properties properties = new Properties();
        if (!username.isEmpty()) {
            properties.setProperty("user", username);
        }
        if (!credentialEnvVarName.isEmpty()) {
            String credential = System.getenv(credentialEnvVarName);
            if (credential == null) {
                return errorResponse(requestId, "authentication_failed", "JDBC authentication credential environment variable was not available.", false);
            }
            properties.setProperty("password", credential);
        }

        try (Connection connection = DriverManager.getConnection(jdbcUrl, properties)) {
            try {
                connection.setReadOnly(true);
            } catch (SQLException ignored) {
                // Some drivers do not support connection read-only mode.
            }

            try (Statement statement = connection.createStatement()) {
                statement.setMaxRows(rowLimit);
                statement.setQueryTimeout(Math.max(1, (int) Math.ceil(timeoutMs / 1000.0)));

                try (ResultSet resultSet = statement.executeQuery(sql)) {
                    ResultSetMetaData metadata = resultSet.getMetaData();
                    int columnCount = Math.min(metadata.getColumnCount(), maxColumns);
                    List<Column> columns = new ArrayList<>();
                    for (int index = 1; index <= columnCount; index += 1) {
                        String name = metadata.getColumnLabel(index);
                        if (name == null || name.isEmpty()) {
                            name = metadata.getColumnName(index);
                        }
                        columns.add(new Column(name, valueKind(metadata.getColumnType(index))));
                    }

                    List<List<String>> rows = new ArrayList<>();
                    int totalRows = 0;
                    while (resultSet.next()) {
                        totalRows += 1;
                        if (rows.size() >= rowLimit) {
                            continue;
                        }
                        List<String> row = new ArrayList<>();
                        for (int index = 1; index <= columnCount; index += 1) {
                            Object value = resultSet.getObject(index);
                            row.add(value == null ? "" : String.valueOf(value));
                        }
                        rows.add(row);
                    }

                    long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000L;
                    return completedResponse(requestId, columns, rows, totalRows, rowLimit, maxColumns, maxCellChars, maxResultBytes, elapsedMs, false);
                }
            }
        } catch (SQLTimeoutException error) {
            return errorResponse(requestId, "timeout", "JDBC read-only query timed out.", false);
        } catch (SQLInvalidAuthorizationSpecException error) {
            return errorResponse(requestId, "authentication_failed", "JDBC authentication failed. Credential details were redacted.", false);
        } catch (SQLException error) {
            String status = isAuthenticationFailure(error) ? "authentication_failed" : "execution_failed";
            String message = isAuthenticationFailure(error)
                ? "JDBC authentication failed. Credential details were redacted."
                : "JDBC read-only query execution failed.";
            return errorResponse(requestId, status, message, false);
        } catch (RuntimeException error) {
            return errorResponse(requestId, "execution_failed", "JDBC read-only query execution failed.", false);
        }
    }

    private static String completedResponse(String requestId, List<Column> columns, List<List<String>> rows, int rowCount, int rowLimit, int maxColumns, int maxCellChars, int maxResultBytes, long durationMs, boolean mockExecution) {
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
        field(json, "duration_ms", (int) Math.min(Integer.MAX_VALUE, durationMs)).append(',');
        json.append("\"sanitized_error\":null,");
        field(json, "no_secrets_returned", true).append(',');
        field(json, "no_ai_context_shared", true).append(',');
        field(json, "mock_execution", mockExecution);
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

    private static List<String> row(String first, String second) {
        List<String> row = new ArrayList<>();
        row.add(first);
        row.add(second);
        return row;
    }

    private static void loadDriver(String driverJarPath, String driverClassName) throws SidecarFailure {
        if (driverJarPath == null || driverJarPath.isEmpty()) {
            throw new SidecarFailure("not_configured", "JDBC driver JAR path is required for experimental sidecar execution.");
        }

        File driverJar = new File(driverJarPath);
        if (!driverJar.isFile()) {
            throw new SidecarFailure("unsupported_driver", "JDBC driver JAR could not be loaded.");
        }

        try {
            URLClassLoader loader = new URLClassLoader(new URL[] { driverJar.toURI().toURL() }, JdbcReadOnlySidecar.class.getClassLoader());
            if (driverClassName != null && !driverClassName.isEmpty()) {
                Class<?> driverClass = Class.forName(driverClassName, true, loader);
                Object driver = driverClass.getDeclaredConstructor().newInstance();
                if (driver instanceof Driver) {
                    DriverManager.registerDriver(new DriverShim((Driver) driver));
                }
            }
        } catch (ClassNotFoundException error) {
            throw new SidecarFailure("unsupported_driver", "JDBC driver class was not found in the explicit driver JAR.");
        } catch (Exception error) {
            throw new SidecarFailure("unsupported_driver", "JDBC driver could not be loaded.");
        }
    }

    private static boolean isAuthenticationFailure(SQLException error) {
        String sqlState = error.getSQLState();
        return error instanceof SQLInvalidAuthorizationSpecException
            || (sqlState != null && sqlState.startsWith("28"));
    }

    private static String valueKind(int sqlType) {
        switch (sqlType) {
            case java.sql.Types.BIGINT:
            case java.sql.Types.DECIMAL:
            case java.sql.Types.DOUBLE:
            case java.sql.Types.FLOAT:
            case java.sql.Types.INTEGER:
            case java.sql.Types.NUMERIC:
            case java.sql.Types.REAL:
            case java.sql.Types.SMALLINT:
            case java.sql.Types.TINYINT:
                return "number";
            case java.sql.Types.BIT:
            case java.sql.Types.BOOLEAN:
                return "boolean";
            case java.sql.Types.DATE:
            case java.sql.Types.TIME:
            case java.sql.Types.TIMESTAMP:
            case -101:
            case -102:
                return "temporal";
            default:
                return "text";
        }
    }

    private static boolean isSidecarReadOnlySql(String sql) {
        String scanSql;
        try {
            scanSql = scanSqlForClassification(sql == null ? "" : sql.trim());
        } catch (IllegalArgumentException error) {
            return false;
        }
        if (containsMultipleStatements(scanSql)) {
            return false;
        }
        String statementSql = trimSingleTrailingSemicolon(scanSql.trim());
        List<String> tokens = sqlTokens(statementSql);
        if (tokens.isEmpty()) {
            return false;
        }
        for (String token : tokens) {
            if (isUnsafeToken(token)) {
                return false;
            }
        }
        String firstToken = tokens.get(0);
        return "SELECT".equals(firstToken) || "WITH".equals(firstToken);
    }

    private static String scanSqlForClassification(String sql) {
        StringBuilder output = new StringBuilder(sql.length());
        int index = 0;
        while (index < sql.length()) {
            char current = sql.charAt(index);
            char next = index + 1 < sql.length() ? sql.charAt(index + 1) : '\0';

            if (current == '-' && next == '-') {
                index += 2;
                while (index < sql.length() && sql.charAt(index) != '\n') {
                    index += 1;
                }
                output.append(' ');
                continue;
            }

            if (current == '/' && next == '*') {
                index += 2;
                boolean closed = false;
                while (index + 1 < sql.length()) {
                    if (sql.charAt(index) == '*' && sql.charAt(index + 1) == '/') {
                        index += 2;
                        closed = true;
                        break;
                    }
                    index += 1;
                }
                if (!closed) {
                    throw new IllegalArgumentException("unterminated block comment");
                }
                output.append(' ');
                continue;
            }

            if (current == '\'' || current == '"') {
                char quote = current;
                index += 1;
                boolean closed = false;
                while (index < sql.length()) {
                    if (sql.charAt(index) == quote) {
                        if (index + 1 < sql.length() && sql.charAt(index + 1) == quote) {
                            index += 2;
                            continue;
                        }
                        index += 1;
                        closed = true;
                        break;
                    }
                    index += 1;
                }
                if (!closed) {
                    throw new IllegalArgumentException("unterminated quoted value");
                }
                output.append(' ');
                continue;
            }

            output.append(current);
            index += 1;
        }
        return output.toString();
    }

    private static boolean containsMultipleStatements(String sql) {
        boolean sawSemicolon = false;
        for (int index = 0; index < sql.length(); index += 1) {
            char current = sql.charAt(index);
            if (current == ';') {
                if (sawSemicolon) {
                    return true;
                }
                sawSemicolon = true;
                continue;
            }
            if (sawSemicolon && !Character.isWhitespace(current)) {
                return true;
            }
        }
        return false;
    }

    private static String trimSingleTrailingSemicolon(String sql) {
        String trimmed = sql.trim();
        if (trimmed.endsWith(";")) {
            return trimmed.substring(0, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private static List<String> sqlTokens(String sql) {
        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (int index = 0; index < sql.length(); index += 1) {
            char character = sql.charAt(index);
            if (Character.isLetterOrDigit(character) || character == '_') {
                current.append(Character.toUpperCase(character));
            } else if (current.length() > 0) {
                tokens.add(current.toString());
                current.setLength(0);
            }
        }
        if (current.length() > 0) {
            tokens.add(current.toString());
        }
        return tokens;
    }

    private static boolean isUnsafeToken(String token) {
        String[] unsafe = {
            "INSERT", "UPDATE", "DELETE", "MERGE", "CREATE", "ALTER", "DROP",
            "TRUNCATE", "GRANT", "REVOKE", "CALL", "EXEC", "EXECUTE", "COPY",
            "LOAD", "EXPORT", "IMPORT", "SET", "USE", "BEGIN", "COMMIT",
            "ROLLBACK", "LOCK", "UNLOCK", "VACUUM", "ANALYZE", "PRAGMA",
            "ATTACH", "DETACH", "EXTENSION", "OUTFILE", "INFILE"
        };
        for (String unsafeToken : unsafe) {
            if (unsafeToken.equals(token)) {
                return true;
            }
        }
        return false;
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

    private static final class SidecarFailure extends Exception {
        private final String status;

        private SidecarFailure(String status, String message) {
            super(message);
            this.status = status;
        }
    }

    private static final class DriverShim implements Driver {
        private final Driver driver;

        private DriverShim(Driver driver) {
            this.driver = driver;
        }

        public boolean acceptsURL(String url) throws SQLException {
            return driver.acceptsURL(url);
        }

        public Connection connect(String url, Properties info) throws SQLException {
            return driver.connect(url, info);
        }

        public int getMajorVersion() {
            return driver.getMajorVersion();
        }

        public int getMinorVersion() {
            return driver.getMinorVersion();
        }

        public DriverPropertyInfo[] getPropertyInfo(String url, Properties info) throws SQLException {
            return driver.getPropertyInfo(url, info);
        }

        public boolean jdbcCompliant() {
            return driver.jdbcCompliant();
        }

        public Logger getParentLogger() {
            try {
                return driver.getParentLogger();
            } catch (SQLFeatureNotSupportedException error) {
                return Logger.getLogger("com.hobit.jdbc");
            } catch (Exception error) {
                return Logger.getLogger("com.hobit.jdbc");
            }
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
