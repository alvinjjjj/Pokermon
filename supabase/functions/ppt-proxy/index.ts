/**
 * PPT Proxy — Supabase Edge Function
 *
 * Forwards requests to PokemonPriceTracker API server-side,
 * bypassing browser CORS restrictions and keeping the API key secure.
 *
 * URL: POST https://<project>.supabase.co/functions/v1/ppt-proxy
 * Body: { endpoint: string; params: Record<string, string> }
 *
 * Deploy: supabase functions deploy ppt-proxy --no-verify-jwt
 *
 * Security: Requires a valid Supabase JWT in the Authorization header.
 * Only authenticated Collectr users can consume PPT API credits.
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PPT_BASE          = 'https://www.pokemonpricetracker.com/api/v2';
const PPT_KEY           = Deno.env.get('POKEPRICE_API_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Limits ────────────────────────────────────────────────────────────────────
// Per-user-per-hour cap on proxy calls. Worst case (3 credits per call):
//   60 calls * 3 credits = 180 credits/h per user → ~4,320/day max per user
// With 5,000 DAU we'd need a fraction of users at the cap to risk the daily
// budget; realistic usage stays well below.
const PER_USER_HOUR_LIMIT = 60;

// Hard upstream-cost caps. The client may pass anything; we clamp BEFORE
// hitting PPT so a malicious user can't ask for `limit=1000&days=180` and
// burn 1000+ credits in a single call.
const PARAM_CAPS: Record<string, number> = {
  limit: 50,
  days:  30,
};
const ALLOWED_BOOL_PARAMS = new Set(['includeHistory', 'includeEbay']);
const ALLOWED_STRING_PARAMS = new Set([
  'language', 'search', 'set', 'tcgPlayerId',
  'sortBy', 'sortOrder', 'minPrice', 'maxPrice',
]);

function clampParams(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (typeof v !== 'string') continue;
    if (PARAM_CAPS[k] !== undefined) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n > 0) {
        out[k] = String(Math.min(n, PARAM_CAPS[k]));
      }
      continue;
    }
    if (ALLOWED_BOOL_PARAMS.has(k)) {
      out[k] = v === 'true' ? 'true' : 'false';
      continue;
    }
    if (ALLOWED_STRING_PARAMS.has(k)) {
      // Strip control chars and cap length defensively
      out[k] = v.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200);
    }
    // Unknown params are silently dropped
  }
  return out;
}

serve(async (req: Request) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  // ── JWT verification ────────────────────────────────────────────────────────
  // Reject requests without a valid Supabase session token.
  // This prevents unauthorized parties from consuming PPT API credits.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ── Rate limit ──────────────────────────────────────────────────────────────
  // Atomic increment via SECURITY DEFINER RPC. If it returns > limit, reject.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: usageCount, error: rateErr } = await admin.rpc('bump_proxy_usage', {
    p_user_id: user.id, p_proxy_name: 'ppt',
  });
  if (rateErr) {
    console.warn('[ppt-proxy] rate-limit RPC failed:', rateErr.message);
    // Fail open on RPC failure rather than DoS the user — but log.
  } else if (typeof usageCount === 'number' && usageCount > PER_USER_HOUR_LIMIT) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after: 3600 }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '3600' } },
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const { endpoint, params } = await req.json() as {
      endpoint: string;
      params:   Record<string, string>;
    };

    if (!endpoint || typeof endpoint !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing endpoint' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Allowlist of upstream endpoints we'll proxy
    const ALLOWED_ENDPOINTS = ['/cards'];
    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const clamped = clampParams(params ?? {});
    const url = `${PPT_BASE}${endpoint}?${new URLSearchParams(clamped)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${PPT_KEY}` },
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[ppt-proxy] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
