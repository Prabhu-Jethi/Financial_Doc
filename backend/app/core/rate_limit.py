import time
import threading
from collections import deque
from typing import Dict, Deque, Optional
from fastapi import Request, HTTPException, status, Depends

from .security import get_optional_user, AuthenticatedUser


class InMemoryRateLimiter:
    """Thread-safe sliding-window rate limiter keyed by authenticated user_id or peer IP."""

    def __init__(self, max_requests: int, window_seconds: int, key_prefix: str = "rl"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        self._buckets: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, request: Request, user: Optional[AuthenticatedUser] = None) -> None:
        # shortcut: in-memory single-process limiter by user_id or peer IP (ignores spoofable X-Forwarded-For);
        # upgrade to Redis + trusted-proxy header if scaling across multiple workers or behind a CDN.
        if user and user.user_id:
            key = f"{self.key_prefix}:user:{user.user_id}"
        else:
            host = request.client.host if request.client and request.client.host else "unknown"
            key = f"{self.key_prefix}:ip:{host}"

        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            # Evict stale buckets opportunistically so rotated client keys never leak memory
            if len(self._buckets) > 1000:
                stale = [k for k, q in self._buckets.items() if not q or q[-1] <= cutoff]
                for k in stale:
                    del self._buckets[k]

            bucket = self._buckets.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please wait before sending more requests.",
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)


def rate_limit(max_requests: int, window_seconds: int, key_prefix: str):
    """Creates a FastAPI dependency enforcing a per-user/IP sliding-window limit."""
    limiter = InMemoryRateLimiter(max_requests=max_requests, window_seconds=window_seconds, key_prefix=key_prefix)

    def _dependency(
        request: Request,
        user: Optional[AuthenticatedUser] = Depends(get_optional_user),
    ) -> None:
        limiter.check(request, user)

    return _dependency
