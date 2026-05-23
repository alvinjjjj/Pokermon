import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModerateRequest {
  post_id: string;
  media_url: string;
  media_type: 'image' | 'video';
}

interface SightengineResponse {
  status: string;
  nudity?: {
    sexual_activity: number;
    sexual_display: number;
    erotica: number;
    very_suggestive: number;
    suggestive: number;
    none: number;
  };
  offensive?: {
    prob: number;
  };
  gore?: {
    prob: number;
  };
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  sexual_activity: 0.3,   // 非常低容忍度
  sexual_display:  0.3,
  erotica:         0.4,
  very_suggestive: 0.6,
  offensive:       0.7,
  gore:            0.6,
};

function isExplicit(result: SightengineResponse): boolean {
  const n = result.nudity;
  if (!n) return false;
  if (n.sexual_activity  > THRESHOLDS.sexual_activity)  return true;
  if (n.sexual_display   > THRESHOLDS.sexual_display)   return true;
  if (n.erotica          > THRESHOLDS.erotica)          return true;
  if (n.very_suggestive  > THRESHOLDS.very_suggestive)  return true;
  if ((result.offensive?.prob ?? 0) > THRESHOLDS.offensive) return true;
  if ((result.gore?.prob ?? 0)      > THRESHOLDS.gore)      return true;
  return false;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method Not Allowed' }, 405);
  }

  // ── JWT verification ────────────────────────────────────────────────────────
  // Without this, anyone with the URL could (a) burn Sightengine credits, or
  // (b) flip arbitrary posts' moderation_status via the service-role admin
  // client below.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }

  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResp({ error: 'Unauthorized' }, 401);
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const { post_id, media_url, media_type }: ModerateRequest = await req.json();

    if (!post_id || !media_url) {
      return jsonResp({ error: 'Missing post_id or media_url' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── Ownership check ───────────────────────────────────────────────────────
    // The caller must own the post they're submitting for moderation. This
    // blocks an authenticated attacker from approving/burning credits on
    // someone else's post.
    const { data: postRow, error: postErr } = await supabase
      .from('posts').select('user_id').eq('id', post_id).single();
    if (postErr || !postRow) return jsonResp({ error: 'Post not found' }, 404);
    if (postRow.user_id !== user.id) return jsonResp({ error: 'Forbidden' }, 403);

    const sightengineUser   = Deno.env.get('SIGHTENGINE_API_USER');
    const sightengineSecret = Deno.env.get('SIGHTENGINE_API_SECRET');

    // ── If no Sightengine credentials, auto-approve ───────────────────────────
    if (!sightengineUser || !sightengineSecret) {
      await supabase
        .from('posts')
        .update({ moderation_status: 'approved' })
        .eq('id', post_id);
      return jsonResp({ status: 'approved', reason: 'no_credentials' });
    }

    let approved = true;
    let rejectReason = '';

    if (media_type === 'image') {
      // ── Image moderation ────────────────────────────────────────────────────
      const params = new URLSearchParams({
        url:        media_url,
        models:     'nudity-2.1,offensive,gore',
        api_user:   sightengineUser,
        api_secret: sightengineSecret,
      });

      const siRes  = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
      const siData = await siRes.json() as SightengineResponse;

      if (siData.status !== 'success') {
        // API error → approve with log (don't block user on API error)
        console.error('Sightengine error:', siData);
      } else if (isExplicit(siData)) {
        approved    = false;
        rejectReason = 'explicit_content';
      }
    } else {
      // ── Video: submit for async moderation ──────────────────────────────────
      // Sightengine video moderation is async — for now flag as pending
      // and approve after 30s timeout (can be upgraded to webhook later)
      const params = new URLSearchParams({
        stream_url: media_url,
        models:     'nudity,offensive',
        api_user:   sightengineUser,
        api_secret: sightengineSecret,
      });

      const siRes  = await fetch(`https://api.sightengine.com/1.0/video/check.json?${params}`);
      const siData = await siRes.json();

      if (siData.status === 'success' && siData.request?.id) {
        // Poll result for up to 20 seconds
        const requestId = siData.request.id;
        let explicit    = false;

        for (let i = 0; i < 4; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const pollRes  = await fetch(
            `https://api.sightengine.com/1.0/video/check.json?request_id=${requestId}&api_user=${sightengineUser}&api_secret=${sightengineSecret}`
          );
          const pollData = await pollRes.json();
          if (pollData.status === 'finished') {
            // Check frame-level results
            const frames: SightengineResponse[] = pollData.data?.frames ?? [];
            explicit = frames.some(f => isExplicit(f));
            break;
          }
        }

        if (explicit) {
          approved     = false;
          rejectReason = 'explicit_content';
        }
      }
      // If video moderation failed / timed out → approve (don't block)
    }

    // ── Update post status ────────────────────────────────────────────────────
    const newStatus = approved ? 'approved' : 'rejected';

    await supabase
      .from('posts')
      .update({ moderation_status: newStatus })
      .eq('id', post_id);

    // ── If rejected: delete from storage ─────────────────────────────────────
    if (!approved) {
      const urlParts  = media_url.split('/storage/v1/object/public/posts/');
      const filePath  = urlParts[1];
      if (filePath) {
        await supabase.storage.from('posts').remove([filePath]);
      }
      console.warn(`Post ${post_id} rejected: ${rejectReason}`);
    }

    return jsonResp({ status: newStatus, reason: rejectReason || 'clean' });

  } catch (err) {
    console.error('moderate-post error:', err);
    return jsonResp({ error: 'internal_error' }, 500);
  }
});
