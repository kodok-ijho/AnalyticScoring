import re


class SqlValidationError(ValueError):
    """Raised when an editable query is outside the supported read-only subset."""


_BLOCKED_WORDS = {
    "alter",
    "attach",
    "backup",
    "bulk",
    "copy",
    "create",
    "delete",
    "detach",
    "drop",
    "exec",
    "execute",
    "export",
    "grant",
    "import",
    "insert",
    "install",
    "load",
    "merge",
    "openrowset",
    "opendatasource",
    "revoke",
    "truncate",
    "update",
}


def validate_read_only_sql(sql: str) -> None:
    stripped = _strip_leading_comments(sql.strip())
    if not stripped:
        raise SqlValidationError("SQL query cannot be empty.")

    without_trailing_semicolon = stripped[:-1].strip() if stripped.endswith(";") else stripped
    if ";" in without_trailing_semicolon:
        raise SqlValidationError("Only one SELECT or CTE query is allowed.")

    lowered = without_trailing_semicolon.lower()
    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise SqlValidationError("Only read-only SELECT or CTE queries are allowed.")

    tokens = set(re.findall(r"\b[a-z_][a-z0-9_]*\b", _without_literals(lowered)))
    blocked = sorted(tokens & _BLOCKED_WORDS)
    if blocked:
        raise SqlValidationError(f"Blocked SQL keyword: {blocked[0]}.")
    if re.search(r"\bselect\s+into\b", lowered, re.IGNORECASE):
        raise SqlValidationError("SELECT INTO is not allowed.")


def _strip_leading_comments(sql: str) -> str:
    remaining = sql.lstrip()
    while remaining.startswith("--"):
        _, _, remaining = remaining.partition("\n")
        remaining = remaining.lstrip()
    return remaining


def _without_literals(sql: str) -> str:
    return re.sub(r"'(?:''|[^'])*'", "''", sql)
