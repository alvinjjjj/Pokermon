import { corsHeaders } from '../_shared/cors.ts';

const API_BASE = 'https://api.pokemontcg.io/v2';

type SearchCardsBody = {
  op: 'searchCards';
  q: string;
  pageSize?: number;
  orderBy?: string;
};

type GetCardBody = {
  op: 'getCard';
  id: string;
};

type RequestBody = SearchCardsBody | GetCardBody;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('POKEMONTCG_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'POKEMONTCG_API_KEY not configured' }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  let url: string;
  if (body.op === 'searchCards') {
    if (typeof body.q !== 'string' || body.q.length === 0) {
      return jsonResponse({ error: 'q is required' }, 400);
    }
    const params = new URLSearchParams();
    params.set('q', body.q);
    if (body.pageSize) params.set('pageSize', String(body.pageSize));
    if (body.orderBy) params.set('orderBy', body.orderBy);
    url = `${API_BASE}/cards?${params.toString()}`;
  } else if (body.op === 'getCard') {
    if (typeof body.id !== 'string' || body.id.length === 0) {
      return jsonResponse({ error: 'id is required' }, 400);
    }
    url = `${API_BASE}/cards/${encodeURIComponent(body.id)}`;
  } else {
    return jsonResponse({ error: 'Unknown op' }, 400);
  }

  const upstream = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
