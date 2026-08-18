from fastapi.testclient import TestClient

from app.api.sqlserver import _safe_details
from app.main import app


def test_safe_details_does_not_leak_password_in_dsn() -> None:
    assert "secret" not in _safe_details(Exception("Login failed;PWD=secret"), ["secret"])
    assert "PWD=***" in _safe_details(Exception("Login failed;PWD=secret"), [])


def test_scoring_query_rejects_unsafe_sql_before_connecting() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/scoring/query",
        json={
            "connection": {
                "server": "localhost",
                "username": "user",
                "password": "secret",
                "database": "DesSy",
            },
            "sql": "UPDATE users SET name = 'x'",
            "mpg": "all",
            "periodeStart": "2025-10-01",
            "periodeEnd": "2026-07-01",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "SQL_QUERY_VALIDATION_FAILED"
