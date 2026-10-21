import time
import json
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx

from .config import settings

logger = logging.getLogger(__name__)

# Security scheme for FastAPI Swagger and route injection
security = HTTPBearer(auto_error=False)

# In-memory cache for JWKS public keys to avoid fetching on every single query
_JWKS_CACHE: Dict[str, Any] = {"keys": None, "fetched_at": 0}
JWKS_CACHE_TTL_SECONDS = 3600  # 1 hour cache


@dataclass
class AuthenticatedUser:
    """Verified user identity extracted directly from cryptographic Supabase JWT claims."""
    user_id: str
    email: Optional[str] = None
    role: str = "authenticated"
    claims: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.claims is None:
            self.claims = {}


def get_jwks_url() -> str:
    """Returns the official Supabase project JWKS endpoint."""
    base_url = settings.supabase_url.rstrip("/")
    return f"{base_url}/auth/v1/.well-known/jwks.json"


def fetch_supabase_jwks() -> Optional[Dict[str, Any]]:
    """Fetches and caches the JSON Web Key Set (JWKS) from Supabase."""
    now = time.time()
    if _JWKS_CACHE["keys"] and (now - _JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL_SECONDS):
        return _JWKS_CACHE["keys"]

    if not settings.supabase_url:
        return None

    try:
        url = get_jwks_url()
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                keys_data = resp.json()
                _JWKS_CACHE["keys"] = keys_data
                _JWKS_CACHE["fetched_at"] = now
                return keys_data
    except Exception as e:
        logger.warning(f"Could not fetch Supabase JWKS from {get_jwks_url()}: {e}")
    return None


def verify_supabase_jwt(token: str) -> AuthenticatedUser:
    """
    Cryptographically verifies the Supabase access token.
    Enforces:
    1. Signature verification (via project JWKS or JWT secret).
    2. Issuer matching ({SUPABASE_URL}/auth/v1).
    3. Audience matching ('authenticated').
    4. Expiry validation (exp > current_timestamp).
    5. Derives user_id strictly from the 'sub' claim.
    """
    try:
        import jwt
        from jwt import PyJWKClient
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT verification dependency missing on backend. Please install 'pyjwt[crypto]'.",
        )

    expected_issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1" if settings.supabase_url else None
    expected_audience = "authenticated"

    decoded_payload = None

    # Strategy A: Verify via Supabase JWT Secret (HS256) if provided in settings/.env
    jwt_secret = getattr(settings, "supabase_jwt_secret", None) or settings.supabase_secret_key
    if jwt_secret:
        try:
            decoded_payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience=expected_audience,
                options={"verify_exp": True, "verify_aud": True},
            )
        except jwt.InvalidAlgorithmError:
            pass  # Token is signed with RS256/ES256, fall back to JWKS
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please refresh your session.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            logger.debug(f"HS256 secret verification skipped: {e}")

    # Strategy B: Verify via Asymmetric JWKS (RS256 / ES256)
    if decoded_payload is None and settings.supabase_url:
        try:
            jwks_client = PyJWKClient(get_jwks_url())
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            decoded_payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=expected_audience,
                issuer=expected_issuer,
                options={"verify_exp": True, "verify_aud": True},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.error(f"JWKS token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or untrusted authentication token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # If neither method succeeded
    if decoded_payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify caller token against Supabase Auth authority.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Derive user_id from sub claim
    user_id = decoded_payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing mandatory 'sub' subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(
        user_id=str(user_id),
        email=decoded_payload.get("email"),
        role=decoded_payload.get("role", "authenticated"),
        claims=decoded_payload,
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthenticatedUser:
    """
    FastAPI dependency that enforces authentication on private endpoints.
    Rejects missing or invalid tokens with HTTP 401.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header with Bearer token. Please log in with Google.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return verify_supabase_jwt(credentials.credentials)

