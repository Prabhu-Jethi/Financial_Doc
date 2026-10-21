from fastapi import APIRouter
from .query import router as query_router
from .document import router as document_router
from .health import router as health_router
from .auth import router as auth_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(query_router)
api_router.include_router(document_router)
