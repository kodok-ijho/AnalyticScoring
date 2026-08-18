from fastapi import FastAPI

from app.api.sqlserver import router as sqlserver_router


def create_app() -> FastAPI:
    app = FastAPI(title="iScore SQL Server API", version="0.1.0")
    app.include_router(sqlserver_router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
