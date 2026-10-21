from fastapi import APIRouter, Depends
from ...core.security import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.get("/me")
def get_autheticated_user_pfp(user: AuthenticatedUser = Depends(get_current_user)):
    '''Returns the validated Supabase user profile from JWT claims.'''
    return {
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
        "authenticated": True,
    }

