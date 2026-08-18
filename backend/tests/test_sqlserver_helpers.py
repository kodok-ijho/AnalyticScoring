from datetime import date, datetime
from decimal import Decimal

from app.db.sqlserver import _dsn, _json_value, execute_query
from app.models.sqlserver import SqlServerConnection


def test_dsn_escapes_connection_values() -> None:
    config = SqlServerConnection(
        server="sql;server",
        username="user=name",
        password="secret",
        database="DesSy",
    )
    dsn = _dsn(config, config.database)
    assert "Server={sql;server}" in dsn
    assert "UID={user=name}" in dsn
    assert "PWD=secret" in dsn


def test_json_value_serializes_database_scalars() -> None:
    assert _json_value(date(2026, 7, 1)) == "2026-07-01"
    assert _json_value(datetime(2026, 7, 1, 12, 30)) == "2026-07-01T12:30:00"
    assert _json_value(Decimal("1.25")) == 1.25


def test_execute_query_binds_runtime_filters(monkeypatch) -> None:
    class Cursor:
        description = [("Periode", str)]

        def execute(self, *args):
            self.args = args

        def fetchmany(self, _size):
            return [("2026-01-01",)]

    class Connection:
        def __init__(self):
            self.cursor_instance = Cursor()

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def cursor(self):
            return self.cursor_instance

    connection = Connection()
    monkeypatch.setattr("app.db.sqlserver._connect", lambda *_args, **_kwargs: connection)
    config = SqlServerConnection(
        server="localhost", username="user", password="secret", database="DesSy"
    )
    columns, rows, limit_exceeded, _duration = execute_query(
        config,
        "WITH Data AS (SELECT 1 AS Value) SELECT Value FROM Data",
        "MPG-A",
        date(2025, 10, 1),
        date(2026, 7, 1),
        100_000,
        30_000,
    )
    assert columns == ["Periode"]
    assert rows == [["2026-01-01"]]
    assert not limit_exceeded
    assert connection.cursor_instance.args[1:] == ("MPG-A", "2025-10-01", "2026-07-01")
