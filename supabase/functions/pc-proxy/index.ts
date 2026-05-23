/**
 * PriceCharting Proxy — Supabase Edge Function
 *
 * Forwards requests to PriceCharting API server-side, keeping the API token
 * out of the JS bundle and requiring an authenticated Collectr session.
 *
 * URL: POST https://<project>.supabase.co/functions/v1/pc-proxy
 * Body: { endpoint: '/api/product' | '/api/products'; params: Record<string, string> }
 *
 * Deploy: supabase functions deploy pc-proxy --no-verify-jwt
 * Secrets: supabase secrets set PRICECHARTING_TOKEN=<your_token>
 *
 * Security: requires a valid Supabase JWT in the Authorization header.
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PC_BASE           = 'https://www.pricecharting.com';
const PC_TOKEN          = Deno.env.get('PRICECHARTING_TOKEN') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Sealed-product prices change daily at most. The 3-day Supabase cache
// absorbs nearly all calls, so a real user should hit this proxy < 30 times/hour.
const PER_USER_HOUR_LIMIT = 30;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ALLOWED_ENDPOINTS = ['/api/product', '/api/products'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  // ── JWT verification ────────────────────────────────────────────────────────
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
  // ────────────────────────────────────────────────────────────────────────────

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: usageCount, error: rateErr } = await admin.rpc('bump_proxy_usage', {
    p_user_id: user.id, p_proxy_name: 'pc',
  });
  if (rateErr) {
    console.warn('[pc-proxy] rate-limit RPC failed:', rateErr.message);
  } else if (typeof usageCount === 'number' && usageCount > PER_USER_HOUR_LIMIT) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after: 3600 }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '3600' } },
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (!PC_TOKEN) {
    // Token not configured — return empty response so client falls back to static prices
    return new Response(JSON.stringify({ error: 'not_configured' }), {
      status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

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
    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Inject the token server-side
    const search = new URLSearchParams({ ...(params ?? {}), t: PC_TOKEN });
    const url    = `${PC_BASE}${endpoint}?${search}`;
    const res    = await fetch(url, { headers: { Accept: 'application/json' } });
    const body   = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
