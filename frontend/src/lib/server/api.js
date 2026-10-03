const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const QUERY_TIMEOUT_MS = 45000; // 45-second deadline per Trd.md § 9

/**
 * Server-side adapter forwarding queries to FastAPI.
 * Keeps credentials and internal URLs on the Next.js server.
 */
export async function forwardQueryToFastAPI(payload, requestId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/api/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store", // Never cache financial answers per rules.md § 3.1
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(
        errorBody.error || errorBody.detail || `FastAPI error (HTTP ${res.status})`
      );
    }

    return await res.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Query deadline of ${QUERY_TIMEOUT_MS / 1000}s exhausted`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Checks backend liveness and database readiness.
 */
export async function checkFastAPIHealth() {
  try {
    const [liveRes, readyRes] = await Promise.all([
      fetch(`${FASTAPI_BASE_URL}/health/live`, { cache: "no-store" }),
      fetch(`${FASTAPI_BASE_URL}/health/ready`, { cache: "no-store" }),
    ]);

    const live = liveRes.ok ? await liveRes.json() : { status: "not ready" };
    const ready = readyRes.ok ? await readyRes.json() : { status: "not ready" };

    return { live, ready };
  } catch (err) {
    return {
      live: { status: "offline", error: "Backend unreachable" },
      ready: { status: "offline", error: err.message },
    };
  }
}
