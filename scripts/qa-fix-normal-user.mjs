/**
 * 修復 user_normal@test.com 的 profile username
 * 執行：node scripts/qa-fix-normal-user.mjs
 */

const SUPABASE_URL = 'https://vudqydqzrlgetcdegfvc.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY env var not set. Run with: node --env-file=.env scripts/qa-fix-normal-user.mjs');
}

const H = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Prefer':        'return=representation',
};

// 取得 user_normal 的 UUID
const listRes  = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=100`, { headers: H });
const listData = await listRes.json();
const user     = listData.users?.find(u => u.email === 'user_normal@test.com');

if (!user) { console.error('❌ 找不到 user_normal@test.com'); process.exit(1); }
console.log(`✅ 找到用戶 ID: ${user.id}`);

// Upsert profile
const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
  method: 'POST',
  headers: { ...H, 'Prefer': 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ id: user.id, username: 'normal_user' }),
});
const upsertData = await upsertRes.json();
console.log('✅ Profile upserted:', upsertData?.[0]?.username ?? upsertData);

// 驗證
const check = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=id,username`, { headers: H });
const checkData = await check.json();
console.log(`\n🎉 最終結果：username = "${checkData?.[0]?.username}"`);
console.log('   可以用 user_normal@test.com / Test1234! 登入了！');
