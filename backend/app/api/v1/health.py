import psycopg
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from ...core.config import settings

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("/live")
def health_live():
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}

@router.get("/ready")
def health_ready():
    '''Checks database connectivity and readiness of the application.'''
    if not settings.database_url:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not ready", "error": "DATABASE_URL not configured"}
        )
    try:
        with psycopg.connect(settings.database_url, connect_timeout=settings.database_timeout_seconds) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"status": "not ready", "error": str(e)}
        )
        