/**
 * debug-artofpkm.mjs v2 — 深入分析 HTML 結構
 */

const url = 'https://www.artofpkm.com/pokemon/5/cards';

const res = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
});

const html = await res.text();

// ── 1. 找 M-P 在哪裡 ──────────────────────────────────────────
console.log('=== 所有 "M-P" 出現的位置 (前後 200 字):');
let searchIdx = 0;
while (true) {
  const idx = html.indexOf('M-P', searchIdx);
  if (idx === -1) break;
  console.log('\n--- M-P @ offset', idx, '---');
  console.log(html.slice(Math.max(0, idx - 150), idx + 150));
  searchIdx = idx + 1;
}

// ── 2. 找所有 <a 標籤的 href 值 ──────────────────────────────
console.log('\n\n=== 所有 <a> 標籤的 href 值:');
const hrefRegex = /<a\s[^>]*href="([^"]+)"/g;
let m;
const hrefs = [];
while ((m = hrefRegex.exec(html)) !== null) {
  hrefs.push(m[1]);
}
hrefs.forEach((h, i) => console.log(`  [${i}] ${h.slice(0, 100)}`));

// ── 3. 找第一個 <img 標籤 ──────────────────────────────────────
console.log('\n\n=== 前 5 個 <img> 標籤:');
const imgRegex = /<img[^>]+>/g;
let imgCount = 0;
while ((m = imgRegex.exec(html)) !== null && imgCount < 5) {
  console.log('\n', m[0].slice(0, 200));
  imgCount++;
}

// ── 4. 找 "045" 在哪裡 ────────────────────────────────────────
console.log('\n\n=== "045" 附近的 HTML:');
const idx045 = html.indexOf('045');
if (idx045 > -1) {
  console.log(html.slice(Math.max(0, idx045 - 200), idx045 + 200));
}

// ── 5. 找 rails/active_storage 在哪個屬性裡 ──────────────────
console.log('\n\n=== rails/active_storage 在哪個屬性 (前 3 個):');
let railsIdx = 0;
let railsCount = 0;
while (railsCount < 3) {
  const idx = html.indexOf('rails/active_storage', railsIdx);
  if (idx === -1) break;
  // 往前找屬性名
  const before = html.slice(Math.max(0, idx - 30), idx);
  console.log(`\n  屬性前綴: "${before}"`);
  // 往後找完整 URL
  const urlEnd = html.indexOf('"', idx);
  console.log(`  URL: ${html.slice(idx, Math.min(urlEnd, idx + 100))}...`);
  railsIdx = idx + 1;
  railsCount++;
}
