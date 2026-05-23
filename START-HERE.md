# 由呢度開始 · 第一步

**你而家要做嘅嘢：** 備份你部 Mac 上嘅 project file。

**為咩：** 你寫咗好多 code，但全部都未存入「歷史」(git)。如果電腦壞咗 = 全失。
我哋要先做一個壓縮檔備份，咁就唔會 lose data。

**需要時間：** 15 分鐘。

---

## ⏱ Step 1 · 打開 Claude Code

### 1a · 開 Terminal
- 撳 ⌘ + Space（spotlight 搜尋）
- 打 `terminal`，撳 Enter
- 會見到一個黑色窗口

### 1b · 入去 collectr 資料夾
喺 terminal 入面，paste 呢一句、撳 Enter：
```
cd /Users/alvin/collectr
```

### 1c · 開 Claude Code
paste 呢一句、撳 Enter：
```
claude
```

等到出現一個 prompt（會見到一個輸入位 — 通常有 `>` 或者類似符號）。

✅ **如果見到 prompt = Step 1 done，繼續 Step 2**
❌ **如果有 error = STOP，paste 出嚟比我**

---

## ⏱ Step 2 · Paste 呢段 prompt 入 Claude Code

**完整 copy 以下灰色 block 入面所有嘢，paste 入 Claude Code，撳 Enter：**

```
Task: Snapshot the working tree before any repo hygiene operations.
Read-only. No git operations. No file modifications inside the repo.

Run these commands and report output:

1. Confirm current state:
   git -C /Users/alvin/collectr status --short | wc -l
   git -C /Users/alvin/collectr branch --show-current
   git -C /Users/alvin/collectr rev-parse HEAD

2. Create timestamped tarball OUTSIDE the repo:
   BACKUP_DIR="$HOME/collectr-backups"
   mkdir -p "$BACKUP_DIR"
   TS=$(date +%Y%m%d-%H%M%S)
   BACKUP_FILE="$BACKUP_DIR/collectr-pre-hygiene-$TS.tar.gz"

   tar --exclude='node_modules' \
       --exclude='.expo' \
       --exclude='ios/build' \
       --exclude='android/build' \
       --exclude='android/.gradle' \
       --exclude='dist' \
       -czf "$BACKUP_FILE" \
       -C /Users/alvin collectr

3. Verify tarball:
   ls -lh "$BACKUP_FILE"
   tar -tzf "$BACKUP_FILE" | head -20
   tar -tzf "$BACKUP_FILE" | wc -l

4. Echo the BACKUP_FILE path back so I can record it.

Do NOT touch the repo. Do NOT run any git command that mutates state.
If tarball creation fails (disk space, permissions), STOP and report.
```

---

## ⏱ Step 3 · 等 Claude Code 做完

Claude Code 會自己跑幾條 command。
可能要 30 秒到 2 分鐘（睇你個 project 幾大）。

佢做完會 print 出：
- Backup file 位置（譬如 `~/collectr-backups/collectr-pre-hygiene-20260523-103045.tar.gz`）
- 檔案 size（應該 50MB-300MB 左右）
- 入面 file 數量（應該幾千個）

---

## ⏱ Step 4 · 將 output paste 返嚟比我

整段 copy（由 Claude Code 開始做嗰陣，到佢最後一句 output），paste 入呢個對話。

唔需要整理、唔需要解釋。

---

## 我會做嘅嘢
- 睇你 output，confirm backup 成功
- 計清楚你部 Mac 而家 state
- 教你 Step 5（下一個 prompt）

---

## ⚠ 如果出錯
- 任何 error message → paste 比我，唔好亂試
- 唔肯定 → 問我
- Claude Code 似乎卡住 → 等 5 分鐘，仲卡 paste 出嚟比我
- **唔好** 嘗試自己 debug、唔好開其他 file、唔好做唔喺呢 doc 入面嘅嘢

---

收。你而家就由 Step 1 開始得喇。
