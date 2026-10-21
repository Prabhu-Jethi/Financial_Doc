from ..core.security import get_current_user, AuthenticatedUser

# Re-export core auth dependencies for API endpoints
__all__ = ["get_current_user", "AuthenticatedUser"]