import psycopg
import uvicorn
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .api.document import router as document_router
from .api.query import router as query_router


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"]
)

app.include_router(query_router, prefix="/api/v1")
app.include_router(document_router, prefix="/api/v1")

@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "docs_url": "/docs",
        "health_check": "/health/ready",
    }

@app.get("/health/live", tags=["Health"])
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
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            content={"status": "not ready", "error": str(e)})
    


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)