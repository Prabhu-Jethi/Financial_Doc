import logging
import psycopg
import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .core.config import settings
from .api.v1.router import api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store, private")
    return response


app.include_router(api_router, prefix="/api/v1")

@app.api_route("/", methods=["GET", "HEAD"], tags=["Root"])
def root():
    payload = {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "health_check": "/health/ready",
    }
    if settings.debug:
        payload["docs_url"] = "/docs"
    return payload

@app.api_route("/health/live", methods=["GET", "HEAD"], tags=["Health"])
def health_live():
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}

@app.get("/health/ready", tags=["Health"])
def health_ready():
    '''Checks database connectivity and readiness of the application.'''
    if not settings.database_url:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            content={"status": "not ready", "error": "DATABASE_URL: not configured"})
    
    try:
        with psycopg.connect(settings.database_url, 
                             connect_timeout=settings.database_timeout_seconds) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
        return {"status": "ready", 
                "database": "connected"}
    except Exception as e:
        logger.warning(f"Database readiness check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            content={"status": "not ready", "error": str(e) if settings.debug else "Database connectivity check failed."})
    


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)