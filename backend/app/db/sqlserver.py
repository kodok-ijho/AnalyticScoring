from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from time import perf_counter
from typing import Any

from app.models.sqlserver import SqlServerConnection, SqlServerCredentialRequest
from app.services.sql_safety import validate_read_only_sql


def _require_pyodbc():
    try:
        import pyodbc
    except ImportError as exc:  # pragma: no cover - exercised only without system dependency
        raise RuntimeError(
            "SQL Server support requires pyodbc and Microsoft ODBC Driver 18 for SQL Server."
        ) from exc
    return pyodbc


def _odbc_value(value: str) -> str:
    if any(char in value for char in (";", "{", "}", "=")):
        return "{" + value.replace("}", "}}") + "}"
    return value


def _dsn(config: SqlServerConnection | SqlServerCredentialRequest, database: str) -> str:
    return ";".join(
        [
            f"Driver={{{config.driver}}}",
            f"Server={_odbc_value(config.server)}",
            f"Database={_odbc_value(database)}",
            f"UID={_odbc_value(config.username)}",
            f"PWD={_odbc_value(config.password)}",
            f"Encrypt={'yes' if config.encrypt else 'no'}",
            f"TrustServerCertificate={'yes' if config.trust_server_certificate else 'no'}",
        ]
    )


def _connect(config: SqlServerConnection | SqlServerCredentialRequest, database: str, timeout_ms: int):
    pyodbc = _require_pyodbc()
    return pyodbc.connect(_dsn(config, database), timeout=max(1, timeout_ms // 1000))


def list_databases(config: SqlServerCredentialRequest, timeout_ms: int) -> list[str]:
    with _connect(config, "master", timeout_ms) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT name FROM sys.databases WHERE state = 0 ORDER BY name")
        return [str(row[0]) for row in cursor.fetchall()]


def list_mpgs(config: SqlServerConnection, timeout_ms: int) -> list[str]:
    sql = (
        "SELECT DISTINCT LTRIM(RTRIM(MPG)) "
        "FROM [dbo].[SCORING-CE_ManPower] "
        "WHERE ISNULL(LTRIM(RTRIM(MPG)), '') <> '' "
        "ORDER BY LTRIM(RTRIM(MPG))"
    )
    with _connect(config, config.database, timeout_ms) as connection:
        cursor = connection.cursor()
        cursor.execute(sql)
        return [str(row[0]) for row in cursor.fetchall()]


def execute_query(
    config: SqlServerConnection,
    sql: str,
    mpg: str,
    periode_start: date,
    periode_end: date,
    max_rows: int,
    timeout_ms: int,
) -> tuple[list[str], list[list[Any]], bool, int]:
    validate_read_only_sql(sql)
    preamble = (
        "DECLARE @MPG AS VARCHAR(10) = ?;\n"
        "DECLARE @PeriodeStart AS DATETIME = ?;\n"
        "DECLARE @PeriodeEnd AS DATETIME = ?;\n"
    )

    started = perf_counter()
    with _connect(config, config.database, timeout_ms) as connection:
        cursor = connection.cursor()
        try:
            cursor.timeout = max(1, timeout_ms // 1000)
        except AttributeError:
            pass
        cursor.execute(
            preamble + sql,
            mpg,
            periode_start.isoformat(),
            periode_end.isoformat(),
        )
        description = cursor.description or []
        columns = [str(item[0]) for item in description]
        if len(columns) != len({column.casefold() for column in columns}):
            raise ValueError("Query returned duplicate column names.")
        fetched = cursor.fetchmany(max_rows + 1)

    limit_exceeded = len(fetched) > max_rows
    rows = fetched[:max_rows]
    duration_ms = int((perf_counter() - started) * 1000)
    return columns, [[_json_value(value) for value in row] for row in rows], limit_exceeded, duration_ms


def _json_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value
