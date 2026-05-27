/**
 * fetchWithTimeout — wraps fetch() with an AbortController-based deadline.
 *
 * Why this exists:
 *   The pokemontcg.io public API has no server-side timeout and can hang
 *   30s+ under rate-limit / network pressure. React Native's default fetch
 *   timeout on iOS is ~60s, so an uncapped call blocks the UI for a minute
 *   in the worst case. Search tab cold-start was measured at 20–30s+ on
 *   2026-05-27 with this exact pattern.
 *
 *   lib/pokeprice.ts already caps PPT calls at PPT_DEFAULT_TIMEOUT_MS =
 *   8000ms — this helper extends that pattern to anywhere we hit
 *   pokemontcg.io directly (or any other third-party API without its own
 *   client SDK timeout).
 *
 * Behavior:
 *   - Default 8000ms timeout (matches PPT for consistency).
 *   - On timeout, the underlying fetch is aborted; the promise rejects
 *     with an AbortError. Callers should chain `.catch(() => fallback)`
 *     to keep the UI responsive.
 *   - Composes with caller-supplied AbortSignal — if caller has its own
 *     signal (e.g. search.tsx's per-keystroke cancellation), the
 *     timeout deadline still fires independently. First abort wins.
 *
 * Usage:
 *   const res = await fetchWithTimeout(url, { headers }, 5000)
 *     .then(r => r.json())
 *     .catch(() => ({ data: [] }));
 */
export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If caller passed a signal, forward its abort to our controller so
  // either path (caller-cancel OR timeout) tears down the fetch.
  const callerSignal = init.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }
}
