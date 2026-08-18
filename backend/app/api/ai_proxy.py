import json
import urllib.request
import urllib.error
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/ai", tags=["ai_proxy"])


@router.post("/chat/completions")
async def proxy_chat_completions(request: Request) -> JSONResponse:
    """
    Server-side proxy for LLM chat completions.
    Bypasses browser CORS restrictions and forwards to target LLM endpoint.
    """
    try:
        body: Dict[str, Any] = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc

    target_endpoint: str = request.headers.get(
        "X-Target-Endpoint", "https://api.tokenrouter.com/v1/chat/completions"
    )
    auth_header: str | None = request.headers.get("Authorization")

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "iScore-Analytics-Backend/1.0",
    }
    if auth_header:
        headers["Authorization"] = auth_header

    data_bytes = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        target_endpoint,
        data=data_bytes,
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            resp_body = response.read().decode("utf-8")
            return JSONResponse(
                content=json.loads(resp_body),
                status_code=response.status,
            )
    except urllib.error.HTTPError as err:
        err_content = err.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(err_content)
            return JSONResponse(content=parsed, status_code=err.code)
        except Exception:
            return JSONResponse(
                content={"error": {"message": err_content or err.reason}},
                status_code=err.code,
            )
    except Exception as exc:
        return JSONResponse(
            content={"error": {"message": f"Proxy request failed: {str(exc)}"}},
            status_code=502,
        )
