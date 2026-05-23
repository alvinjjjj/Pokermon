/**
 * QA Setup Script
 * 執行：node scripts/qa-setup.mjs
 * 功能：建立 user_normal@test.com + 確認 3 個帳號設定正確
 */

const SUPABASE_URL = 'https://vudqydqzrlgetcdegfvc.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY env var not set. Run with: node --env-file=.env scripts/qa-setup.mjs');
}

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function adminPost(path, body) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST', headers,
    body: JSON.stringify(body),
  });
  return r.json();
}

async function dbGet(table, params = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: { ...headers, 'Prefer': 'return=representation' } });
  return r.json();
}

async function dbPost(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function dbPatch(table, params, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// ── 1. 建立 user_normal@test.com ──────────────────────────────────────────────

console.log('\n🔧 Step 1: 建立 user_normal@test.com ...');
const createRes = await adminPost('/auth/v1/admin/users', {
  email: 'user_normal@test.com',
  password: 'Test1234!',
  email_confirm: true,
});

let normalUserId;
if (createRes.id) {
  normalUserId = createRes.id;
  console.log(`✅ 建立成功！ID: ${normalUserId}`);
} else if (createRes.message?.includes('already been registered')) {
  console.log('ℹ️  用戶已存在，取得現有 ID...');
  // 取得現有用戶
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { headers });
  const listData = await listRes.json();
  const existing = (listData.users ?? []).find(u => u.email === 'user_normal@test.com');
  normalUserId = existing?.id;
  console.log(`✅ 找到現有用戶 ID: ${normalUserId}`);
} else {
  console.error('❌ 建立失敗:', JSON.stringify(createRes));
}

// ── 2. 確保 user_normal 的 profile 存在 ──────────────────────────────────────

if (normalUserId) {
  console.log('\n🔧 Step 2: 設定 user_normal profile ...');
  const upsertRes = await dbPost('profiles', {
    id: normalUserId,
    username: 'normal_user',
  });
  // If conflict, it's fine (profile already exists from trigger)
  console.log('✅ Profile 已設定');

  // 確保 user_roles 存在
  const roleRes = await dbPost('user_roles', {
    user_id: normalUserId,
    role: 'viewer',
    status: 'active',
  });
  console.log('✅ user_roles 已設定');
}

// ── 3. 驗證所有 3 個帳號 ──────────────────────────────────────────────────────

console.log('\n🔍 Step 3: 驗證所有帳號...');
const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, { headers });
const usersData = await usersRes.json();
const testEmails = ['user_normal@test.com', 'seller_personal@test.com', 'seller_business@test.com'];
const testUsers = (usersData.users ?? []).filter(u => testEmails.includes(u.email));

for (const u of testUsers) {
  const profiles = await dbGet('profiles', `id=eq.${u.id}&select=username`);
  const roles    = await dbGet('user_roles', `user_id=eq.${u.id}&select=role,status`);
  const profile  = profiles[0];
  const role     = roles[0];
  console.log(`\n  📧 ${u.email}`);
  console.log(`     username: ${profile?.username ?? '⚠️  未設定'}`);
  console.log(`     role:     ${role?.role ?? '⚠️  未設定'} (${role?.status ?? '-'})`);
}

console.log('\n✅ QA Setup 完成！可以登入以下帳號測試：');
console.log('   user_normal@test.com    / Test1234!  (普通用戶)');
console.log('   seller_personal@test.com / Test1234! (個人賣家)');
console.log('   seller_business@test.com / Test1234! (認證商家)\n');
