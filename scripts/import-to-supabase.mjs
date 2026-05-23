/**
 * import-to-supabase.mjs
 * 把 data/artofpkm-promo-map.json 上傳到 Supabase artofpkm_card_images table
 *
 * 用法:
 *   node scripts/import-to-supabase.mjs
 *   node scripts/import-to-supabase.mjs --dry-run   ← 只預覽，不實際上傳
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 讀入 .env ──────────────────────────────────────────────────────────────
// 簡單解析 .env（不用 dotenv 套件）
const envPath = join(__dirname, '../.env');
const envVars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL          = envVars['EXPO_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY  = envVars['SUPABASE_SERVICE_ROLE_KEY'];
const SUPABASE_ANON_KEY     = envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL) {
  console.error('❌ 找不到 EXPO_PUBLIC_SUPABASE_URL in .env');
  process.exit(1);
}

// Prefer service role key (bypasses RLS) for seeding scripts.
// Falls back to anon key – but anon key will fail if INSERT policy is missing.
const KEY_USED = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
if (!KEY_USED) {
  console.error('❌ 找不到 SUPABASE_SERVICE_ROLE_KEY 或 EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY 未設定，使用 anon key（可能遇到 RLS 限制）');
}

const isDryRun = process.argv.includes('--dry-run');
const supabase = createClient(SUPABASE_URL, KEY_USED);

// ── 讀入 JSON ──────────────────────────────────────────────────────────────
const mapPath = join(__dirname, '../data/artofpkm-promo-map.json');
const promoMap = JSON.parse(readFileSync(mapPath, 'utf8'));

const entries = Object.entries(promoMap).map(([key, image_url]) => ({
  key,
  image_url,
}));

console.log(`📦 artofpkm → Supabase Import`);
console.log(`   筆數: ${entries.length}`);
console.log(`   目標: ${SUPABASE_URL}`);
if (isDryRun) console.log(`   模式: DRY RUN（不實際上傳）`);
console.log();

// ── 預覽 5 筆 ──────────────────────────────────────────────────────────────
console.log('範例資料:');
entries.slice(0, 5).forEach(e => {
  console.log(`  "${e.key}" → "${e.image_url.slice(0, 60)}..."`);
});
console.log();

if (isDryRun) {
  console.log('✅ Dry run 完成，沒有實際上傳。');
  process.exit(0);
}

// ── Batch upsert（每批 200 筆）────────────────────────────────────────────
const BATCH_SIZE = 200;
let uploaded = 0;
let errors = 0;

for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

  process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} rows)... `);

  const { error } = await supabase
    .from('artofpkm_card_images')
    .upsert(batch, { onConflict: 'key' });

  if (error) {
    console.error(`❌ ${error.message}`);
    errors++;
  } else {
    console.log(`✅`);
    uploaded += batch.length;
  }
}

console.log();
console.log('════════════════════════════');
if (errors === 0) {
  console.log(`✅ 成功上傳 ${uploaded} 筆到 artofpkm_card_images`);
} else {
  console.log(`⚠️  上傳完成，${uploaded} 筆成功，${errors} 批次失敗`);
}
