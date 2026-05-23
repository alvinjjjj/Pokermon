"""
╔══════════════════════════════════════════════════════════════╗
║   Pokemon TCG 日版卡盒圖片下載 + 去背工具                    ║
║   輸出: 1024×1024 白底 PNG，依序存 001_xxx.png               ║
╠══════════════════════════════════════════════════════════════╣
║   安裝依賴 (在 Terminal 執行):                                ║
║   pip install rembg pillow requests opencv-python            ║
║                                                              ║
║   使用方式:                                                   ║
║   python3 pokemon_box_downloader.py                          ║
║                                                              ║
║   圖片來源:                                                   ║
║   - 自動: 腳本搜 eBay，抓第一張商品圖                         ║
║   - 手動: 在 BOX_LIST 填入 url= 直接指定圖片網址              ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import re
import sys
import time
import requests
import numpy as np
import cv2
from io import BytesIO
from urllib.parse import quote_plus
from PIL import Image
from typing import Optional

# ── 輸出資料夾 ─────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "pokemon_box_images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

CANVAS_SIZE = 1024
PADDING     = 70          # 物件與邊緣距離(px)
BG_THRESH   = 240         # 白底偵測門檻 (0-255)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
}


# ════════════════════════════════════════════════════════════════
# 卡盒清單  ─ 格式: (編號文字, 中文名, 英文搜尋詞, 圖片URL or None)
# url=None → 腳本自動搜 eBay；填 URL → 直接用指定圖片
# ════════════════════════════════════════════════════════════════
BOX_LIST = [
    # ── MEGA ──────────────────────────────────────────────────
    ("M1",   "緋紅狂嘯",       "Crimson Haze M1 Japanese booster box",        None),
    ("M2",   "業炎X",          "Inferno X M2 Japanese booster box",            None),
    ("M2a",  "夢幻之夢 ex",    "Mega Dream ex M2a Japanese booster box",       None),
    ("M3",   "虛無零式",       "Nihil Zero M3 Japanese booster box",           None),
    ("M4",   "忍者旋轉器",     "Ninja Spinner M4 Japanese booster box",        None),

    # ── Scarlet & Violet ──────────────────────────────────────
    ("SV1",  "朱色ex",         "Scarlet ex SV1 Japanese booster box sealed",   None),
    ("SV1",  "紫色ex",         "Violet ex SV1 Japanese booster box sealed",    None),
    ("SV1a", "三重拍",         "Triplet Beat SV1a Japanese booster box",       None),
    ("SV2",  "黏土爆發",       "Clay Burst SV2 Japanese booster box",          None),
    ("SV2",  "雪危機",         "Snow Hazard SV2 Japanese booster box",         None),
    ("SV2a", "151",            "Pokemon 151 SV2a Japanese booster box",        None),
    ("SV3",  "黑炎之王",       "Ruler of Black Flame SV3 Japanese booster",    None),
    ("SV3",  "洶湧衝浪",       "Raging Surf SV3 Japanese booster box",         None),
    ("SV4",  "古代咆哮",       "Ancient Roar SV4 Japanese booster box",        None),
    ("SV4",  "未來閃光",       "Future Flash SV4 Japanese booster box",        None),
    ("SV4a", "閃耀寶藏ex",     "Shiny Treasure ex SV4a Japanese booster",      None),
    ("SV5k", "狂野力量",       "Wild Force SV5k Japanese booster box",         None),
    ("SV5m", "電腦判決",       "Cyber Judge SV5m Japanese booster box",        None),
    ("SV6",  "面具變換",       "Mask of Change SV6 Japanese booster box",      None),
    ("SV6a", "夜行者",         "Night Wanderer SV6a Japanese booster box",     None),
    ("SV7",  "星光奇蹟",       "Stellar Miracle SV7 Japanese booster box",     None),
    ("SV7a", "樂園之龍",       "Paradise Dragona SV7a Japanese booster box",   None),
    ("SV8",  "超電磁風暴",     "Super Electric Breaker SV8 Japanese booster",  None),
    ("SV8a", "晶化節慶ex",     "Terastal Festival ex SV8a Japanese booster",   None),
    ("SV9",  "同行冒險",       "Journey Together SV9 Japanese booster box",    None),
    ("SV10", "火箭隊",         "Team Rocket SV10 Japanese booster box",        None),
    ("SV11B","黑色閃電",       "Black Bolt SV11B Japanese booster box",        None),
    ("SV11W","白色烈焰",       "White Flare SV11W Japanese booster box",       None),

    # ── Sword & Shield ────────────────────────────────────────
    ("S1W",  "劍",             "Sword S1W Japanese booster box sealed",        None),
    ("S1H",  "盾",             "Shield S1H Japanese booster box sealed",       None),
    ("S2",   "叛亂衝擊",       "Rebellion Crash S2 Japanese booster box",      None),
    ("S3",   "無限地帶",       "Infinite Zone S3 Japanese booster box",        None),
    ("S4",   "驚奇電擊",       "Amazing Volt Tackle S4 Japanese booster box",  None),
    ("S5R",  "急速打擊大師",   "Rapid Strike Master S5R Japanese booster",     None),
    ("S5I",  "一撃大師",       "Single Strike Master S5I Japanese booster",    None),
    ("S6a",  "伊布英雄",       "Eevee Heroes S6a Japanese booster box",        None),
    ("S7R",  "藍天溪流",       "Blue Sky Stream S7R Japanese booster box",     None),
    ("S7D",  "天空完美",       "Skyscraping Perfect S7D Japanese booster",     None),
    ("S8",   "融合藝術",       "Fusion Arts S8 Japanese booster box",          None),
    ("S8b",  "VMAX Climax",   "VMAX Climax S8b Japanese booster box",          None),
    ("S9",   "星辰誕生",       "Star Birth S9 Japanese booster box",           None),
    ("S9a",  "戰鬥軍團",       "Battle Legion S9a Japanese booster box",       None),
    ("S10a", "暗黑幻影",       "Dark Phantasma S10a Japanese booster box",     None),
    ("S10b", "Pokémon GO",    "Pokemon GO S10b Japanese booster box",           None),
    ("S11",  "失落深淵",       "Lost Abyss S11 Japanese booster box",          None),
    ("S12",  "典範觸發",       "Paradigm Trigger S12 Japanese booster box",    None),
    ("S12a", "VSTAR宇宙",      "VSTAR Universe S12a Japanese booster box",     None),
    ("SP",   "25週年紀念",     "25th Anniversary Collection Japanese booster", None),

    # ── Sun & Moon ────────────────────────────────────────────
    ("SM1",  "太陽系列",       "Collection Sun SM1 Japanese booster box",      None),
    ("SM1",  "月亮系列",       "Collection Moon SM1 Japanese booster box",     None),
    ("SM7b", "妖精崛起",       "Fairy Rise SM7b Japanese booster box",         None),
    ("SM9",  "標籤閃電",       "Tag Bolt SM9 Japanese booster box sealed",     None),
    ("SM9a", "夜間同盟",       "Night Unison SM9a Japanese booster box",       None),
    ("SM9b", "GX極致閃耀",     "GX Ultra Shiny SM9b Japanese booster box",     None),
    ("SM11a","混音對決",       "Remix Bout SM11a Japanese booster box",        None),
    ("SM12a","Tag Team GX全明星","Tag Team GX All Stars SM12a Japanese",       None),
    ("SMGX", "GX鬥陣加速",     "GX Battle Boost Japanese booster box",         None),

    # ── XY ────────────────────────────────────────────────────
    ("XY1",  "XY系列X",        "Collection X XY1 Japanese booster box",        None),
    ("XY2",  "狂野烈焰",       "Wild Blaze XY2 Japanese booster box",          None),
    ("XY4",  "幻影之門",       "Phantom Gate XY4 Japanese booster box",        None),
    ("XY6",  "翠玉突破",       "Emerald Break XY6 Japanese booster box",       None),
    ("XY12", "20週年紀念",     "CP6 20th Anniversary XY Japanese booster",     None),
    ("CP1",  "傳說閃耀",       "Legendary Shine CP1 Japanese booster box",     None),
    ("BXY",  "Best of XY",    "Best of XY Japanese booster box",               None),

    # ── Black & White ─────────────────────────────────────────
    ("BW1",  "黑系列",         "Black Collection BW1 Japanese booster box",    None),
    ("BW1",  "白系列",         "White Collection BW1 Japanese booster box",    None),
    ("BW3",  "靈能驅動",       "Psycho Drive BW3 Japanese booster box",        None),
    ("BW5",  "龍之刃",         "Dragon Blade BW5 Japanese booster box",        None),
    ("BWSC", "EX鬥陣加速",     "EX Battle Boost Japanese booster box",         None),
]


# ════════════════════════════════════════════════════════════════
# 去背引擎  (自動選擇 rembg 或 OpenCV fallback)
# ════════════════════════════════════════════════════════════════
try:
    from rembg import remove as rembg_remove
    USE_REMBG = True
    print("✓ 使用 rembg AI 去背 (最佳品質)")
except ImportError:
    USE_REMBG = False
    print("⚠ rembg 未安裝，使用 OpenCV 去背 (run: pip install rembg)")


def remove_background(pil_img: Image.Image) -> Image.Image:
    """去背，返回 RGBA Image"""

    # ── rembg (AI, 最佳) ────────────────────────────────────
    if USE_REMBG:
        buf = BytesIO()
        pil_img.convert("RGB").save(buf, format="PNG")
        buf.seek(0)
        out = rembg_remove(buf.read())
        return Image.open(BytesIO(out)).convert("RGBA")

    # ── OpenCV fallback ─────────────────────────────────────
    img_rgb = np.array(pil_img.convert("RGB"))
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    h, w = img_bgr.shape[:2]

    # 嘗試白底偵測
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, BG_THRESH, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) / (h * w) > 0.08:
            mask = np.zeros((h, w), np.uint8)
            cv2.drawContours(mask, [largest], -1, 255, -1)
            mask = cv2.dilate(mask, np.ones((10, 10), np.uint8), iterations=2)
            result = pil_img.convert("RGBA")
            result.putalpha(Image.fromarray(mask).convert("L"))
            return result

    # GrabCut fallback
    mask_gc = np.zeros((h, w), np.uint8)
    mx, my = max(3, w // 20), max(3, h // 20)
    rect = (mx, my, w - 2 * mx, h - 2 * my)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(img_bgr, mask_gc, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask_gc == 2) | (mask_gc == 0), 0, 255).astype(np.uint8)
    except Exception:
        fg = np.ones((h, w), np.uint8) * 255

    result = pil_img.convert("RGBA")
    result.putalpha(Image.fromarray(fg).convert("L"))
    return result


# ════════════════════════════════════════════════════════════════
# 圖片來源
# ════════════════════════════════════════════════════════════════
def find_image(search_term: str) -> Optional[str]:
    """用 DuckDuckGo 搜圖，返回第一張圖片 URL"""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.images(
                search_term + " japanese booster box sealed",
                max_results=5
            ))
        for r in results:
            url = r.get("image", "")
            if url and url.startswith("http"):
                return url
    except ImportError:
        print("  ✗ 請先安裝: python3 -m pip install duckduckgo-search")
    except Exception as e:
        print(f"    DuckDuckGo 搜尋失敗: {e}")
    return None


def download_image(url: str) -> Optional[Image.Image]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGBA")
    except Exception as e:
        print(f"    下載失敗: {e}")
        return None


# ════════════════════════════════════════════════════════════════
# 合成白底 1024×1024
# ════════════════════════════════════════════════════════════════
def place_on_canvas(img_rgba: Image.Image) -> Image.Image:
    usable = CANVAS_SIZE - 2 * PADDING
    img_rgba = img_rgba.copy()
    img_rgba.thumbnail((usable, usable), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 255, 255, 255))
    x = (CANVAS_SIZE - img_rgba.width) // 2
    y = (CANVAS_SIZE - img_rgba.height) // 2
    canvas.paste(img_rgba, (x, y), img_rgba)
    return canvas.convert("RGB")


# ════════════════════════════════════════════════════════════════
# 主流程
# ════════════════════════════════════════════════════════════════
def main():
    print("=" * 62)
    print("  Pokemon TCG 卡盒圖片工具  |  輸出: 1024×1024 白底 PNG")
    print(f"  資料夾: {OUTPUT_DIR}")
    print("=" * 62)

    ok_count = 0
    for idx, (code, cn, search_term, url) in enumerate(BOX_LIST, 1):
        safe_name = re.sub(r'[^\w]', '_', search_term.split()[0] + "_" + cn)[:40]
        filename  = f"{idx:03d}_{code}_{safe_name}.png"
        out_path  = os.path.join(OUTPUT_DIR, filename)

        # 跳過已存在的檔案
        if os.path.exists(out_path):
            print(f"[{idx:03d}] ✓ 已存在，跳過: {filename}")
            ok_count += 1
            continue

        print(f"\n[{idx:03d}] {cn}  ({code})")

        # 找圖片
        if not url:
            print(f"  → 搜尋圖片: {search_term[:50]}...")
            url = find_image(search_term)
            if not url:
                print("  ✗ 找不到圖片，跳過")
                continue

        print(f"  → {url[:70]}...")
        img = download_image(url)
        if not img:
            continue

        # 去背
        print("  → 去背中...")
        try:
            img_nobg = remove_background(img)
        except Exception as e:
            print(f"  ✗ 去背失敗: {e}，使用原圖")
            img_nobg = img

        # 合成輸出
        final = place_on_canvas(img_nobg)
        final.save(out_path, "PNG", optimize=True)
        print(f"  ✓ {filename}")
        ok_count += 1

        time.sleep(1.2)   # 禮貌性延遲，避免被 eBay 封

    print(f"\n完成！{ok_count}/{len(BOX_LIST)} 張  →  {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
