/**
 * scrape-artofpkm.mjs
 * 從 artofpkm.com 抓取日版 promo 卡片圖片 URL
 * 建立 localId/setCode → imageUrl 的 lookup map
 *
 * 用法:
 *   node scripts/scrape-artofpkm.mjs            ← 抓所有 Pokémon
 *   node scripts/scrape-artofpkm.mjs --test     ← 只測試幾隻 (快速驗證)
 *   node scripts/scrape-artofpkm.mjs --id 25    ← 只抓指定 Pokémon ID
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, '../data/artofpkm-promo-map.json');

const BASE_URL = 'https://www.artofpkm.com';
const PROMO_CODES = ['XY-P', 'SM-P', 'SV-P', 'M-P', 'S-P', 'BW-P', 'L-P'];
const DELAY_MS = 400; // 禮貌性延遲，避免打爆伺服器

// ─── 主角 Pokémon 列表 (約 130 隻，涵蓋各世代主角 / 傳說 / 人氣角色) ───────────
const POPULAR_POKEMON_IDS = new Set([
  // Gen 1
  1,2,3,4,5,6,7,8,9,          // starters
  25,26,                        // Pikachu, Raichu
  39,40,                        // Jigglypuff
  52,54,                        // Meowth, Psyduck
  94,                           // Gengar
  113,131,132,143,              // Chansey, Lapras, Ditto, Snorlax
  133,134,135,136,              // Eevee + Vaporeon/Jolteon/Flareon
  147,148,149,                  // Dratini line
  150,151,                      // Mewtwo, Mew
  // Gen 2
  152,153,154,155,156,157,158,159,160, // starters
  175,176,196,197,              // Togepi, Togetic, Espeon, Umbreon
  249,250,251,                  // Lugia, Ho-Oh, Celebi
  // Gen 3
  252,253,254,255,256,257,258,259,260, // starters
  280,281,282,                  // Ralts line
  350,384,385,386,              // Milotic, Rayquaza, Jirachi, Deoxys
  // Gen 4
  387,388,389,390,391,392,393,394,395, // starters
  443,444,445,                  // Gible line
  448,                          // Lucario
  470,471,                      // Leafeon, Glaceon
  483,484,487,491,493,          // Dialga, Palkia, Giratina, Darkrai, Arceus
  // Gen 5
  495,496,497,498,499,500,501,502,503, // starters
  570,571,                      // Zorua, Zoroark
  643,644,646,649,              // Reshiram, Zekrom, Kyurem, Genesect
  // Gen 6
  650,651,652,653,654,655,656,657,658, // starters
  700,716,717,719,720,          // Sylveon, Xerneas, Yveltal, Diancie, Hoopa
  // Gen 7
  722,723,724,725,726,727,728,729,730, // starters
  745,778,                      // Lycanroc, Mimikyu
  791,792,800,801,807,          // Solgaleo, Lunala, Necrozma, Magearna, Zeraora
  // Gen 8
  810,811,812,813,814,815,816,817,818, // starters
  884,888,889,890,              // Duraludon, Zacian, Zamazenta, Eternatus
  // Gen 9
  906,907,908,909,910,911,912,913,914, // starters
  969,1007,1008,                // Gimmighoul, Koraidon, Miraidon
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`    ⚠ retry ${i + 1}/${retries}: ${err.message}`);
      await sleep(1000 * (i + 1));
    }
  }
}

// ─── 解析單頁的 promo 卡片 ────────────────────────────────────────────────────

function parsePromoCardsFromHtml(html, pokemonName) {
  const results = [];

  // 實際 HTML: <a data-action="..." href="/rails/active_storage/...">
  // href 不是第一個屬性，所以用 [^>]* 允許前面有其他屬性
  const anchorRegex = /<a\b[^>]*\bhref="(\/rails\/active_storage\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    for (const setCode of PROMO_CODES) {
      const escaped = setCode.replace('-', '\\-');
      const m = text.match(new RegExp(`(\\d{1,3})\\/${escaped}(?:\\b|\\s|$)`));
      if (m) {
        const localId = m[1].padStart(3, '0');
        results.push({
          localId,
          setCode,
          key: `${localId}/${setCode}`,
          pokemon: pokemonName,
          imageUrl: `${BASE_URL}${href}`,
        });
        break;
      }
    }
  }

  return results;
}

// ─── Set name → URL slug（和 app 端一致）────────────────────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ─── 解析一頁的所有卡片（promo + regular）────────────────────────────────────
function parseAllCardsFromHtml(html, pokemonName) {
  const results = [];
  const anchorRegex = /<a\b[^>]*\bhref="(\/rails\/active_storage\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // ── 先試 promo 格式 ─────────────────────────────────────────────────────
    let captured = false;
    for (const setCode of PROMO_CODES) {
      const escaped = setCode.replace('-', '\\-');
      const m = text.match(new RegExp(`(\\d{1,3})\\/${escaped}(?:\\b|\\s|$)`));
      if (m) {
        const localId = m[1].padStart(3, '0');
        results.push({
          localId,
          setCode,
          key: `${localId}/${setCode}`,
          pokemon: pokemonName,
          imageUrl: `${BASE_URL}${href}`,
        });
        captured = true;
        break;
      }
    }
    if (captured) continue;

    // ── Regular set card: "026/190 Shiny Treasure ex" ──────────────────────
    // Text 格式: "Charmeleon 026/190 Shiny Treasure ex"
    const m = text.match(/(\d{1,3})\/(\d{2,4})\s+([A-Za-z].+)/);
    if (m) {
      const localId = m[1].padStart(3, '0');
      const setName = m[3].trim();
      const slug = slugify(setName);
      if (!slug) continue;
      results.push({
        localId,
        setName,
        key: `${slug}/${localId}`,
        pokemon: pokemonName,
        imageUrl: `${BASE_URL}${href}`,
      });
    }
  }

  return results;
}

// ─── 取得一隻 Pokémon 的所有 promo 卡（多頁） ─────────────────────────────────

async function scrapePokemonCards(pokemonId, pokemonName) {
  const allCards = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/pokemon/${pokemonId}/cards?page=${page}`;
    let html;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      break;
    }

    const cards = parsePromoCardsFromHtml(html, pokemonName);
    allCards.push(...cards);

    const nextPageRe = new RegExp(`[?&]page=${page + 1}(?:[^0-9]|$)`);
    if (!nextPageRe.test(html)) break;
    page++;
    await sleep(DELAY_MS);
  }

  return allCards;
}

// ─── 產生所有 Pokémon ID（直接用 Pokédex 編號，不依賴列表頁） ──────────────────

function getAllPokemonIds() {
  const ids = new Map();
  for (let i = 1; i <= 1025; i++) {
    ids.set(i, `#${String(i).padStart(4, '0')}`);
  }
  console.log(`📋 使用 Pokédex 編號 1-1025 (${ids.size} 隻)`);
  return ids;
}

// ─── 取得一隻 Pokémon 的所有卡（promo + regular，多頁）───────────────────────
async function scrapePokemonAllCards(pokemonId, pokemonName) {
  const allCards = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/pokemon/${pokemonId}/cards?page=${page}`;
    let html;
    try { html = await fetchHtml(url); } catch { break; }

    const cards = parseAllCardsFromHtml(html, pokemonName);

    // Stop when the page returns no cards (past last page)
    if (cards.length === 0) break;
    allCards.push(...cards);

    // More precise next-page check: look for an href with ?page=N or &page=N
    // (avoids false positives like page=20 matching "page=2")
    const nextPageRe = new RegExp(`[?&]page=${page + 1}(?:[^0-9]|$)`);
    if (!nextPageRe.test(html)) break;

    page++;
    await sleep(DELAY_MS);
  }

  return allCards;
}

// ─── 抓 Characters 頁面的所有 ID ─────────────────────────────────────────────

async function fetchAllCharacterIds() {
  console.log('📋 抓取 Characters 列表...');
  const ids = new Map();
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/characters?page=${page}`;
    let html;
    try { html = await fetchHtml(url); } catch { break; }

    // 找 /characters/{數字} 的連結（完整或相對 URL）
    const linkRegex = /\/characters\/(\d+)/g;
    let match;
    let found = 0;
    while ((match = linkRegex.exec(html)) !== null) {
      const id = parseInt(match[1]);
      if (id > 0 && !ids.has(id)) {
        ids.set(id, `Character#${id}`);
        found++;
      }
    }

    const nextPageRe = new RegExp(`[?&]page=${page + 1}(?:[^0-9]|$)`);
    if (found === 0 || !nextPageRe.test(html)) break;
    page++;
    await sleep(DELAY_MS);
  }

  console.log(`  找到 ${ids.size} 個 Characters`);
  return ids;
}

// ─── 抓一個 Character 頁面的 promo 卡片（只抓 promo set）──────────────────────

async function scrapeCharacterCards(characterId, characterName) {
  const allCards = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/characters/${characterId}/cards?page=${page}`;
    let html;
    try { html = await fetchHtml(url); } catch { break; }

    const cards = parsePromoCardsFromHtml(html, characterName);
    allCards.push(...cards);

    const nextPageRe = new RegExp(`[?&]page=${page + 1}(?:[^0-9]|$)`);
    if (!nextPageRe.test(html)) break;
    page++;
    await sleep(DELAY_MS);
  }

  return allCards;
}

// ─── 抓一個 Character 頁面的「所有」卡片（promo + 一般 set，例如 Sightseer）──
// Old scrapeCharacterCards only catches promo set codes (XY-P, SM-P …).
// Trainer cards from regular sets (e.g. Sightseer 192/173 in Tag Team GX
// All Stars) were silently dropped, leaving them with no image in the app.
async function scrapeCharacterAllCards(characterId, characterName) {
  const allCards = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/characters/${characterId}/cards?page=${page}`;
    let html;
    try { html = await fetchHtml(url); } catch { break; }

    const cards = parseAllCardsFromHtml(html, characterName);
    if (cards.length === 0) break;
    allCards.push(...cards);

    const nextPageRe = new RegExp(`[?&]page=${page + 1}(?:[^0-9]|$)`);
    if (!nextPageRe.test(html)) break;
    page++;
    await sleep(DELAY_MS);
  }

  return allCards;
}

// ─── 主程式 ──────────────────────────────────────────────────────────────────

async function runScrape(label, entries, scraperFn, promoMap) {
  let processed = 0;
  const ids = [...entries.entries()];

  for (const [id, name] of ids) {
    processed++;
    process.stdout.write(`[${processed}/${ids.length}] ${String(name).padEnd(22)} `);

    const cards = await scraperFn(id, name);

    let newCount = 0;
    for (const card of cards) {
      if (!promoMap[card.key]) newCount++;
      promoMap[card.key] = card.imageUrl;
    }

    console.log(
      cards.length > 0
        ? `✅ ${cards.length} promo (${newCount} new) | ${cards.map(c => c.key).slice(0, 8).join(', ')}${cards.length > 8 ? '...' : ''}`
        : `— no promo`
    );

    await sleep(DELAY_MS);

    if (processed % 50 === 0) {
      writeFileSync(OUTPUT_FILE, JSON.stringify(promoMap, null, 2));
      console.log(`\n💾 Checkpoint saved (${Object.keys(promoMap).length} entries)\n`);
    }
  }
}

// ─── /sets/<slug>/cards mode ─────────────────────────────────────────────────
//
// Why this exists: the per-Pokemon / per-Character scrapers only catch cards
// that depict a known character. Non-character trainer cards (Energy / Stadium
// / Item / non-named Supporter) are completely missed.
//
// Going by SET pages bypasses that filter — artofpkm's set page lists every
// card in the set regardless of subtype, so we can fill in the gaps for
// trainer / energy / stadium cards like "Ignition Energy" or "Battle Colosseum".

/**
 * Known JP set slugs on artofpkm.com — mirrors the SET_CODE_TO_ARTOFPKM_SLUG
 * map in `lib/jpImages.ts`. Keys are arbitrary labels for logging; values are
 * the URL slug used by artofpkm.com.
 */
const JP_SET_SLUGS = [
  // ── Scarlet & Violet (JP) ───────────────────────────────────────────────
  'triplet-beat', 'scarlet-ex', 'violet-ex', 'pok-mon-card-151', 'clay-burst',
  'snow-hazard', 'ruler-of-the-black-flame', 'raging-surf', 'shiny-treasure-ex',
  'ancient-roar', 'future-flash', 'crimson-haze', 'wild-force', 'cyber-judge',
  'mask-of-change', 'night-wanderer', 'stellar-miracle', 'paradise-dragona',
  'super-electric-breaker', 'terastal-festival-ex', 'battle-partners',
  'glory-of-team-rocket',
  // ── Sword & Shield (JP) ─────────────────────────────────────────────────
  'vmax-rising', 'shield', 'sword', 'rebellious-clash', 'explosive-walker',
  'infinity-zone', 'legendary-heartbeat', 'amazing-volt-tackle', 'shiny-star-v',
  'matchless-fighters', 'single-strike-master', 'rapid-strike-master',
  'eevee-heroes', 'silver-lance', 'jet-black-poltergeist', 'skyscraping-perfect',
  'blue-sky-stream', 'fusion-arts', '25th-anniversary-collection',
  'vmax-climax', 'star-birth', 'battle-region', 'dark-fantasma', 'pok-mon-go',
  'time-gazer', 'space-juggler', 'lost-abyss', 'incandescent-arcana',
  'paradigm-trigger', 'vstar-universe',
  // ── Sun & Moon (JP) ─────────────────────────────────────────────────────
  'tag-team-gx-all-stars', 'alter-genesis', 'remix-bout', 'dream-league',
  'miracle-twin', 'sky-legend', 'double-blaze', 'night-unison', 'full-metal-wall',
  'tag-bolt', 'dark-order', 'gx-ultra-shiny', 'super-burst-impact',
  'thunderclap-spark', 'fairy-rise', 'sky-guardians', 'forbidden-light',
  'champion-road', 'ultra-shiny-gx', 'astonishing-volt-tackle',
  // ── Decks / supplementary ───────────────────────────────────────────────
  'start-deck-100', 'start-deck-100-battle-collection', 'start-deck-generations',
  'mega-dream-ex', 'premium-champion-pack-ex-x-m-x-break',
  'hot-wind-arena', 'the-best-of-xy', 'base-expansion-pack', 'pok-mon-card-vs',
];

async function scrapeSetCards(slug) {
  const allCards = [];
  let page = 1;
  while (true) {
    const url = `${BASE_URL}/sets/${slug}/cards?page=${page}`;
    let html;
    try { html = await fetchHtml(url); } catch { break; }

    const cards = parseAllCardsFromHtml(html, slug);
    if (cards.length === 0) break;
    allCards.push(...cards);

    const nextPageRe = new RegExp(`[?&]page=${page + 1}(?:[^0-9]|$)`);
    if (!nextPageRe.test(html)) break;
    page++;
    await sleep(DELAY_MS);
  }
  return allCards;
}

async function main() {
  const args = process.argv.slice(2);
  const isTest             = args.includes('--test');
  const isCharacters       = args.includes('--characters');
  const isCharactersAll    = args.includes('--characters-all');
  const isPopular          = args.includes('--popular');
  const isAll              = args.includes('--all');
  const isSets             = args.includes('--sets');
  // --set <slug>: scrape ONE set
  const singleSet = args.includes('--set') ? args[args.indexOf('--set') + 1] : null;
  const specificId    = args.includes('--id') ? parseInt(args[args.indexOf('--id') + 1]) : null;
  // --pokemon N: re-scrape a single Pokémon with ALL card types (promo + regular), all pages
  const singlePokemon = args.includes('--pokemon') ? parseInt(args[args.indexOf('--pokemon') + 1]) : null;
  // --ids 25,6,150: scrape specific Pokémon IDs (comma-separated), all card types
  const specificIds = args.includes('--ids')
    ? args[args.indexOf('--ids') + 1].split(',').map(n => parseInt(n.trim())).filter(Boolean)
    : null;
  // --resume N: skip first N pokemon (resume interrupted run)
  const resumeFrom    = args.includes('--resume') ? parseInt(args[args.indexOf('--resume') + 1]) : 0;

  console.log('🔍 artofpkm.com JP Card Scraper');
  console.log('================================\n');

  // 讀入已有的結果（支援續跑）
  const promoMap = existsSync(OUTPUT_FILE)
    ? JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))
    : {};

  console.log(`📂 已有 ${Object.keys(promoMap).length} 筆資料\n`);

  if (singleSet) {
    // ── Single set mode: scrape one /sets/<slug>/cards page ─────────────────
    console.log(`📦 Single set: ${singleSet}\n`);
    const cards = await scrapeSetCards(singleSet);
    let newCount = 0;
    for (const card of cards) {
      if (!promoMap[card.key]) newCount++;
      promoMap[card.key] = card.imageUrl;
    }
    console.log(`  ✅ ${cards.length} cards (${newCount} new) | sample: ${cards.slice(0, 5).map(c => c.key).join(', ')}`);

  } else if (isSets) {
    // ── Sets mode: scrape /sets/<slug>/cards for every known JP set ─────────
    // Catches non-character trainer cards (energies / stadiums / items) that
    // the per-Pokemon / per-Character scrapes miss.
    console.log(`📦 Sets mode: 抓 ${JP_SET_SLUGS.length} 個 JP set 嘅完整 card list (含 trainer/energy/stadium)\n`);
    let processed = 0;
    for (const slug of JP_SET_SLUGS) {
      processed++;
      process.stdout.write(`[${processed}/${JP_SET_SLUGS.length}] ${slug.padEnd(40)} `);
      const cards = await scrapeSetCards(slug);
      let newCount = 0;
      for (const card of cards) {
        if (!promoMap[card.key]) newCount++;
        promoMap[card.key] = card.imageUrl;
      }
      console.log(cards.length > 0
        ? `✅ ${cards.length} cards (${newCount} new)`
        : `— no cards (set page may not exist)`
      );
      await sleep(DELAY_MS);
      if (processed % 10 === 0) {
        writeFileSync(OUTPUT_FILE, JSON.stringify(promoMap, null, 2));
        console.log(`\n💾 Checkpoint saved (${Object.keys(promoMap).length} entries)\n`);
      }
    }

  } else if (specificIds) {
    // ── IDs mode: scrape a specific list of Pokémon IDs ────────────────────
    console.log(`🎯 IDs mode: 抓指定 ${specificIds.length} 隻 Pokémon (all cards, all pages)\n`);
    const idsMap = new Map(specificIds.map(id => [id, `Pokemon#${id}`]));
    await runScrape('ids', idsMap, scrapePokemonAllCards, promoMap);

  } else if (singlePokemon) {
    // ── Single Pokémon mode: all cards for one Pokémon, useful for testing ──
    console.log(`🔬 Single mode: 抓 Pokémon #${singlePokemon} 的所有卡 (promo + regular, all pages)\n`);
    const singleMap = new Map([[singlePokemon, `Pokemon#${singlePokemon}`]]);
    await runScrape('single', singleMap, scrapePokemonAllCards, promoMap);

  } else if (isAll) {
    // ── All mode: 抓所有 1025 隻 Pokémon 的所有卡（promo + regular）──────────
    console.log(`🌏 All mode: 抓全部 1025 隻 Pokémon 的所有卡 (promo + regular)\n`);
    if (resumeFrom > 0) console.log(`   ⏭  Resume from Pokemon #${resumeFrom}\n`);

    const allMap = new Map();
    for (let i = 1; i <= 1025; i++) {
      if (i < resumeFrom) continue;
      allMap.set(i, `Pokemon#${String(i).padStart(4, '0')}`);
    }
    await runScrape('all-pokemon', allMap, scrapePokemonAllCards, promoMap);

  } else if (isCharactersAll) {
    // ── Characters ALL mode: trainer/character cards from EVERY set ────────
    // Use this to backfill cards like Sightseer 192/173 (Tag Team GX All Stars).
    // The plain --characters mode misses these because it only matches promo
    // set codes (XY-P, SM-P, …). Reusing parseAllCardsFromHtml catches both
    // promo and regular-set trainer cards.
    console.log('👤 Characters-ALL mode: 抓 trainer/character cards (promo + regular sets)\n');
    const charIds = await fetchAllCharacterIds();
    await sleep(DELAY_MS);
    await runScrape('characters-all', charIds, scrapeCharacterAllCards, promoMap);

  } else if (isCharacters) {
    // ── Characters mode: trainer/character promo cards only ───────────────
    console.log('👤 Characters mode: 抓 trainer/character promo cards\n');
    const charIds = await fetchAllCharacterIds();
    await sleep(DELAY_MS);
    await runScrape('characters', charIds, scrapeCharacterCards, promoMap);

  } else if (isPopular) {
    // ── Popular mode: 抓主角 Pokémon 的所有卡（promo + regular）─────────────
    console.log(`⭐ Popular mode: 抓 ${POPULAR_POKEMON_IDS.size} 隻主角 Pokémon 的所有卡\n`);
    const popularMap = new Map(
      [...POPULAR_POKEMON_IDS].map(id => [id, `Pokemon#${id}`])
    );
    await runScrape('popular', popularMap, scrapePokemonAllCards, promoMap);

  } else {
    // ── Pokémon mode (promo only) ───────────────────────────────────────────
    let pokemonMap;
    if (specificId) {
      pokemonMap = new Map([[specificId, `Pokemon#${specificId}`]]);
    } else if (isTest) {
      pokemonMap = new Map([
        [5,   'Charmeleon'],
        [25,  'Pikachu'],
        [133, 'Eevee'],
        [384, 'Rayquaza'],
        [151, 'Mew'],
      ]);
      console.log('🧪 Test mode: 只測試 5 隻 Pokémon\n');
    } else {
      pokemonMap = getAllPokemonIds();
    }
    await runScrape('pokemon', pokemonMap, scrapePokemonCards, promoMap);
  }

  // 最終儲存
  writeFileSync(OUTPUT_FILE, JSON.stringify(promoMap, null, 2));

  console.log('\n================================');
  console.log(`✅ 完成！`);
  console.log(`   卡片總數: ${Object.keys(promoMap).length}`);
  console.log(`   輸出檔案: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
