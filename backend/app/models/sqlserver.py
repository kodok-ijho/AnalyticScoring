from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SqlServerConnection(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    server: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    database: str = Field(min_length=1)
    driver: str = "ODBC Driver 18 for SQL Server"
    encrypt: bool = True
    trust_server_certificate: bool = Field(default=True, alias="trustServerCertificate")


class SqlServerCredentialRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    server: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    driver: str = "ODBC Driver 18 for SQL Server"
    encrypt: bool = True
    trust_server_certificate: bool = Field(default=True, alias="trustServerCertificate")


class DatabaseListResponse(BaseModel):
    databases: list[str]


class MpgListResponse(BaseModel):
    mpgs: list[str]


class SqlServerMpgRequest(BaseModel):
    connection: SqlServerConnection


class SqlServerQueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    connection: SqlServerConnection
    sql: str = Field(min_length=1)
    mpg: str = "all"
    periode_start: date = Field(alias="periodeStart")
    periode_end: date = Field(alias="periodeEnd")
    max_rows: int = Field(default=100_000, alias="maxRows", ge=1, le=100_000)


class SqlServerQueryResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    returned_row_count: int = Field(alias="returnedRowCount")
    limit_exceeded: bool = Field(alias="limitExceeded")
    duration_ms: int = Field(alias="durationMs")
    database: str
