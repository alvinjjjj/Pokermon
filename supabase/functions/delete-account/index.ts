import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify the calling user's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const uid = user.id
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Delete user data in dependency order.
    // Most tables have ON DELETE CASCADE from auth.users via profiles, but we do
    // it explicitly so storage objects + indirect rows are handled.
    //
    // Each delete is logged independently so one schema mismatch (e.g. table
    // renamed in a future migration) doesn't silently leak rows of other tables.
    const safeDelete = async (label: string, fn: () => PromiseLike<{ error: any }>) => {
      try {
        const { error } = await fn()
        if (error) console.warn(`[delete-account] ${label}:`, error.message)
      } catch (e) {
        console.warn(`[delete-account] ${label} threw:`, e)
      }
    }

    await safeDelete('post_reports',   () => admin.from('post_reports').delete().eq('reporter_id', uid))
    await safeDelete('notifications',  () => admin.from('notifications').delete().or(`user_id.eq.${uid},actor_id.eq.${uid}`))
    await safeDelete('post_likes',     () => admin.from('post_likes').delete().eq('user_id', uid))
    await safeDelete('post_comments',  () => admin.from('post_comments').delete().eq('user_id', uid))
    await safeDelete('follows',        () => admin.from('follows').delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`))
    await safeDelete('messages',       () => admin.from('messages').delete().eq('sender_id', uid))
    await safeDelete('conversations',  () => admin.from('conversations').delete().or(`buyer_id.eq.${uid},seller_id.eq.${uid}`))

    // Delete posts + their storage objects
    try {
      const { data: posts } = await admin.from('posts').select('id, media_url').eq('user_id', uid)
      if (posts && posts.length > 0) {
        const storagePaths = posts
          .filter((p: any) => p.media_url)
          .map((p: any) => {
            try { return new URL(p.media_url).pathname.split('/posts/')[1] } catch { return null }
          })
          .filter(Boolean) as string[]
        if (storagePaths.length > 0) {
          await admin.storage.from('posts').remove(storagePaths)
        }
        await admin.from('posts').delete().eq('user_id', uid)
      }
    } catch (e) {
      console.warn('[delete-account] posts cleanup threw:', e)
    }

    // Delete listings + merchant profile
    await safeDelete('listings',          () => admin.from('listings').delete().eq('seller_id', uid))
    await safeDelete('merchant_profiles', () => admin.from('merchant_profiles').delete().eq('user_id', uid))

    // Delete collection + portfolios
    await safeDelete('user_collection',   () => admin.from('user_collection').delete().eq('user_id', uid))
    await safeDelete('portfolios',        () => admin.from('portfolios').delete().eq('user_id', uid))

    // Delete user roles + profile
    await safeDelete('user_roles',        () => admin.from('user_roles').delete().eq('user_id', uid))
    await safeDelete('profiles',          () => admin.from('profiles').delete().eq('id', uid))

    // Finally delete the auth user — cascades remaining linked data
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('delete-account error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
