from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.sqlserver import router as sqlserver_router
from app.api.ai_proxy import router as ai_proxy_router


def create_app() -> FastAPI:
    app = FastAPI(title="iScore SQL Server & AI API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(sqlserver_router)
    app.include_router(ai_proxy_router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
