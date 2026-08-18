from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ISCORE_", extra="ignore")

    api_host: str = "127.0.0.1"
    api_port: int = 8000
    query_timeout_ms: int = 30_000
    database_timeout_ms: int = 15_000
    max_rows: int = 100_000
    sqlserver_driver: str = "ODBC Driver 18 for SQL Server"
    encrypt: bool = True
    trust_server_certificate: bool = True


settings = Settings()
