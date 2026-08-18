import re

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.db.sqlserver import execute_query, list_databases, list_mpgs
from app.models.sqlserver import (
    DatabaseListResponse,
    MpgListResponse,
    SqlServerCredentialRequest,
    SqlServerMpgRequest,
    SqlServerQueryRequest,
    SqlServerQueryResponse,
)
from app.services.sql_safety import SqlValidationError

router = APIRouter(prefix="/api", tags=["sqlserver"])


def _safe_details(error: Exception, secrets: list[str] | None = None) -> str:
    message = str(error)
    for secret in secrets or []:
        if secret:
            message = message.replace(secret, "***")
    return re.sub(r"PWD=[^;\s]+", "PWD=***", message, flags=re.IGNORECASE)


@router.post("/connections/sqlserver/databases", response_model=DatabaseListResponse)
def databases(payload: SqlServerCredentialRequest) -> DatabaseListResponse:
    try:
        return DatabaseListResponse(databases=list_databases(payload, settings.database_timeout_ms))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SQLSERVER_CONNECTION_FAILED",
                "message": "Tidak dapat terhubung ke SQL Server atau membaca daftar database.",
                "safeDetails": _safe_details(exc, [payload.password]),
            },
        ) from exc


@router.post("/connections/sqlserver/mpgs", response_model=MpgListResponse)
def mpgs(payload: SqlServerMpgRequest) -> MpgListResponse:
    try:
        return MpgListResponse(mpgs=list_mpgs(payload.connection, settings.database_timeout_ms))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SQLSERVER_MPG_FAILED",
                "message": "Daftar MPG tidak dapat dimuat dari database terpilih.",
                "safeDetails": _safe_details(exc, [payload.connection.password]),
            },
        ) from exc


@router.post("/scoring/query", response_model=SqlServerQueryResponse)
def scoring_query(payload: SqlServerQueryRequest) -> SqlServerQueryResponse:
    try:
        columns, rows, limit_exceeded, duration_ms = execute_query(
            payload.connection,
            payload.sql,
            payload.mpg,
            payload.periode_start,
            payload.periode_end,
            payload.max_rows,
            settings.query_timeout_ms,
        )
    except Exception as exc:
        code = "SQL_QUERY_VALIDATION_FAILED" if isinstance(exc, SqlValidationError) else "SQL_QUERY_FAILED"
        raise HTTPException(
            status_code=400,
            detail={
                "code": code,
                "message": "Query SQL Server gagal diproses.",
                "safeDetails": _safe_details(exc, [payload.connection.password]),
            },
        ) from exc

    return SqlServerQueryResponse(
        columns=columns,
        rows=rows,
        returnedRowCount=len(rows),
        limitExceeded=limit_exceeded,
        durationMs=duration_ms,
        database=payload.connection.database,
    )
