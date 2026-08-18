from app.services.sql_safety import SqlValidationError, validate_read_only_sql


def test_accepts_default_cte_body() -> None:
    validate_read_only_sql(
        """
        WITH BaseData AS (SELECT 1 AS value)
        SELECT value FROM BaseData;
        """
    )


def test_rejects_multiple_statements() -> None:
    try:
        validate_read_only_sql("SELECT 1; SELECT 2")
    except SqlValidationError as exc:
        assert "one" in str(exc).lower()
    else:  # pragma: no cover
        raise AssertionError("Expected multi-statement query to be rejected")


def test_rejects_write_and_exec_keywords() -> None:
    for query in ("UPDATE users SET name = 'x'", "SELECT * INTO copy FROM users", "EXEC dbo.Report"):
        try:
            validate_read_only_sql(query)
        except SqlValidationError:
            pass
        else:  # pragma: no cover
            raise AssertionError(f"Expected query to be rejected: {query}")
