# TTHOL 原始設計資料：代碼對照表

從 `E:\SETTING\`（遊戲原始設計檔，BIG-5 編碼）分析萃取，用來補齊資料庫裡只剩整數代碼、沒有中文標籤的欄位。

解析方式：`iconv -f BIG-5 -t UTF-8 <file>`。

## 來源檔案

| 檔案 | 作用 | 引用情境 |
|---|---|---|
| `MONSTER.INI` | 全部怪物（2,829 筆）的欄位資料 | `Type` / `SubType` 分類、六圍、掉落 |
| `setting/monster.ini` | 幾乎同上，是 MONSTER.INI 的 `#include` 來源 | 備用 |
| `MAGIC.INI` | 全部技能分等（~6,142 筆）的欄位資料 | `SkillType` / `Attrib` / `Target` / `Clan` |
| `setting/magicdef.ini` | MAGIC.INI 的 `#include`，定義常數符號 | **權威對照表**：CLASS_* / TARGET_* / ELEM_* / MAGIC_* |
| `setting/define.ini` | 通用 `#define` 表（舊版） | ITEM/CHAR flag、目標代碼（部分已過時） |
| `ITEM.INI` | 道具定義、DEFINE 段有**完整 48 種道具類型中文標籤** | `items.type` |
| `SECT.INI` | 門派基本資料（ID=bitflag，名稱用遊戲內顯示字） | 門派名稱、男女立繪 |
| `setting/statusdef.ini` | 38 種狀態群組（GS_*） | 未來如果要顯示 buff/debuff 歸類 |

> 字串 ID：INI 檔裡 `Help = 995859` 這種是外部字串表編號，不在 SQLite 裡、也不必處理。

---

## 1. 怪物 Type（monsters / npc.type）

MONSTER.INI 的 DEFINE 段**沒有** Type 的符號定義，全靠資料分組推斷。跨所有 2,829 筆怪物只出現 7 個值（13–19），分布與代表名稱如下：

| Type | 數量 | 推測分類 | 範例 |
|---:|---:|---|---|
| 13 | 173 | **水族** | ▲企鵝、▲泡泡海馬、▲雨蛙、▲電鰻、▲黑化貝、書法章魚、水鬼、水生蓮妖、爆走水母、魔叉河豚 |
| 14 | 546 | **野獸** | ▲棕熊、▲狐狸、▲礦工鼠、▲虎、▲豪豬、▲青銅飛鼠、土撥鼠、老鼠、野狗、圓月黑熊、凡品妖狐、入魔潑猴 |
| 15 | 137 | **蟲類** | ▲俠客綠螳、▲地獄蟻獅、▲蜘蛛、▲釘鐺木蜢、蝴蝶娘子、迷霧螳螂 |
| 16 | 74 | **植物** | ▲劇毒樹精、牡丹精、花精憨憨 |
| 17 | 1061 | **人形／武者** | ▲三手神偷、▲山賊神射手、▲火忍者、▲雷旗兵、多聞天王、李大嘴、鐵萍姑、魔星谷嘍囉 |
| 18 | 313 | **機關／構裝** | ▲少陽鐵人、▲魔化雪巨人、人型機關、玄鐵木馬、護城砲車、鐵人18號 |
| 19 | 524 | **妖魔／亡靈** | ▲九尾妖狐、修羅王、冥界幽火、寒冰將軍、寒月劍使、幽靈犬、長舌女鬼、無頭小兵 |

> 資料雜訊：有一筆 `Type = 14` 搭配 `SubType = ˋ`（「端午雪虎」），應是手動輸入誤植，忽略。
>
> 其他 Type 以外的欄位（`SubType` 全為 1、`AI`、`NormalScript`）目前無法對應到有意義的中文分類，可先留空。

**建議標籤**：直接把上表「推測分類」寫進 `src/lib/constants/monster-type.ts`，並在 comment 標注「由 E:\\SETTING 原始資料推斷而非官方命名」。

## 2. 怪物屬性（monsters / npc.elemental）

資料庫存中文字串原文（不是代碼）。MONSTER.INI 裡 `Elemental = 火` 這種直接寫中文，DEFINE 段僅作為前四個關鍵字的定義符號：

```
#define ELEM_FIRE       1
#define ELEM_WATER      2
#define ELEM_LIGHTNING  3   // 怪物端顯示「電」
#define ELEM_WOOD       4   // 怪物端顯示「木」
```

對應的抗性欄位：`FireDef`、`WaterDef`、`LightningDef`、`WoodDef`。目前 `npc.elemental` 值域為 `火`、`水`、`電`、`木`、`null`。

## 3. 技能 `magic.attrib`

MAGIC.INI 只有 41 筆技能有 `Attrib` 欄位，值域 **1/2/3/4**；其餘技能為 `null`。符號對照來自 `magicdef.ini`：

| 代碼 | 符號 | 官方 | 目前 app 標籤 |
|---:|---|---|---|
| 1 | `ELEM_FIRE` | 火 | 火 ✔ |
| 2 | `ELEM_WATER` | 水 | 水 ✔ |
| 3 | `ELEM_LIGHTNING` | 雷 | 雷 ✔ |
| 4 | `ELEM_EARTH` | **土** | **木** ⚠️ |

> ⚠️ **不一致**：技能端的 `magicdef.ini` 把代碼 4 叫 `ELEM_EARTH`（土），怪物端的 `MONSTER.INI` 頭註解叫 `ELEM_WOOD`（木）。對應的抗性欄位分別是 `EarthDef`（在技能 INI 的欄位列）、`WoodDef`（在怪物 INI 的欄位列）。遊戲內部設計就把同一個代碼拆成「技能屬性＝土」「怪物系別＝木」。目前 app 統一標成「木」。要不要把技能側改成「土」，或者兩邊都留「木」，看下一次遊戲內文案校對結果再決定。Attrib=4 的範例技能只有「啞門」一個名字很難直接判斷。

## 4. 技能 `magic.skill_type`

MAGIC.INI 裡實際出現的 `SkillType` 值：`1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20`（範圍 1–20，缺 15/16）。`magicdef.ini` 定義到 1–17，18–20 是遊戲後續擴充、沒有官方符號。

| 代碼 | 符號（magicdef） | 建議中文 | 範例技能 |
|---:|---|---|---|
| 1 | `MAGIC_BLADE` | 刀法 | 五虎斷魂刀 |
| 2 | `MAGIC_CHEAT` | 詐招 | 一針見血 |
| 3 | `MAGIC_SWORD` | 劍法 | 劍修練 |
| 4 | `MAGIC_PUNCH` | 拳腳 | 冰霜護體、蓮蒼掌 |
| 5 | `MAGIC_POISON` | 毒術 | 三屍毒、寒毒雪魄 |
| 6 | `MAGIC_HEAL` | 醫療 | 回春、無量回春 |
| 7 | `MAGIC_STING` | 刺／短劍 | 刺槐血契 |
| 8 | `MAGIC_BOT` | 機關術 | 機關人修復 |
| 9 | `MAGIC_DART` | 暗器 | 大手裡劍 |
| 10 | `MAGIC_GSWORD` | 倭刀 | 天王伏魔棍 |
| 11 | `MAGIC_NINJA` | 忍術 | 替身 |
| 12 | `MAGIC_ROD` | 棍法 | 天王伏魔棍（歸棍） |
| 13 | `MAGIC_BOXING` | 拳套 | 羅漢拳、戰狼吞月、嗜血爪擊 |
| 14 | `MAGIC_AURA` | 氣／符陣 | 幻甲符陣 |
| 15 | `MAGIC_FAVORED` | 加護 | （資料裡未出現） |
| 16 | `MAGIC_SPELL` | 咒術 | 咒甲 |
| 17 | `MAGIC_WHISK` | 拂塵 | （資料裡未出現） |
| 18 | *（推斷）* | 禁術／大招 | 三昧紅蓮、原始之怒、天罡意志、爆裂猛擊、禁術修練 |
| 19 | *（推斷）* | 靈種／召喚 | 喋血魔錐靈種、金剛劫扇、熾炎獸靈種 |
| 20 | *（推斷）* | 劍陣 | 伏魔劍陣、雙劍狂暴 |

> 15/17 的符號名有定義但資料裡沒出現。18–20 是推斷值，下一次遊戲校對要優先確認。

## 5. 技能 `magic.target`

`magicdef.ini` 是權威（`define.ini` 較舊、缺幾個值）：

| 代碼 (hex) | 符號 | 中文 |
|---|---|---|
| 0x00 | `TARGET_NONE` | 無 |
| 0x01 | `TARGET_ALLY` | 友方 |
| 0x82 | `TARGET_ENEMY` | 敵方範圍 |
| 0x03 | `TARGET_GROUND` | 地面 |
| 0x04 | `TARGET_ITEM` | 物品 |
| 0x05 | `TARGET_GROUP` | 敵方群體 |
| 0x86 | `TARGET_ENEMYTARGET` | 單一敵人 |
| 0x07 | `TARGET_ATTACK` | 攻擊 |
| 0x08 | `TARGET_PASSIVE` | 被動 |
| 0x09 | `TARGET_SELF` | 自己 |
| 0x0a | `TARGET_ALLY_GROUND` | 友方地面 |
| 0x8b | `TARGET_ENEMYEX` | 敵方延伸 |
| 0x0c | `TARGET_GROUP_ONE` | 單一群體 |
| 0x0d | `TARGET_LOVE` | 戀人對象 |

> SQLite 裡存的是符號字串（`TARGET_ENEMYTARGET` 等），不是 hex 值 — 直接拿符號當 map key 就好。

## 6. 門派（magic.clan / magic.clan2，以及 SECT.INI）

兩個來源有微小字面差：

| bitflag | `magicdef.ini`（技能） | `ITEM.INI` DEFINE 註解 | `SECT.INI` Name |
|---:|---|---|---|
| `0x0001` | `CLASS_NONE` | `CLAN_NONE` 初心者 | 入門弟子 |
| `0x0002` | `CLASS_BAD` | `CLAN_BAD` 惡人谷 | 惡人谷 |
| `0x0004` | `CLASS_FLOWER` | `CLAN_FLOWER` 移花宮 | 移花宮 |
| `0x0008` | `CLASS_SKY` | `CLAN_SKY` 天外天 | 天外天 |
| `0x0010` | `CLASS_ISLE` | `CLAN_ISLE` 無名島 | 無名島 |
| `0x0020` | `CLASS_SHAULIN` | `CLAN_SHAULIN` 少林 | 少林 |
| `0x0040` | `CLASS_MAGIC` | `CLAN_MAGIC` 天師 | 天師 |
| `0x0080` | `CLASS_GOD` | `CLAN_GOD` 神武 | *(未列)* |
| `0x0100` | `CLASS_FOX_NONE` | `CLAN_FOX_NONE` 火狐弟子 | 火狐弟子 |
| `0x0200` | `CLASS_FOX` | `CLAN_FOX` 火狐 | 火狐 |
| `0x0400` | `CLASS_MONTO_NONE` | `CLAN_MONTO_NONE` 曼陀弟子 | 曼陀弟子 |
| `0x0800` | `CLASS_MONTO` | `CLAN_MONTO` **曼陀** | **曼陀** |
| `0x1000` | `CLASS_FOX_SNOW` | `CLAN_FOX_SNOW` 雪狼 | 雪狼 |
| `0x2000` | `CLASS_MONTO_KYLIN` | `CLASS_MONTO_KYLIN` 麒麟 | 麒麟 |
| `0x0501` | `CLASS_CHILD` *(複合：NONE｜FOX_NONE｜MONTO_NONE)* | — | — |
| `0x40000000` | `CLASS_LOVE` | — | — |
| `0x80000000` | `CLASS_GUILD` | — | — |

> ⚠️ **字面差**：官方兩個原始資料檔都寫「曼陀」，目前 app 用「蔓陀蘿」。兩種寫法在 TTHOL 玩家圈都常見（蔓陀蘿是通稱）。`src/lib/constants/magic-clan.ts` 要改成哪個，看下次遊戲內文案校對決定。
>
> 神武門在 SECT.INI 沒有條目（可能是遊戲 bitflag 定義存在但 NPC 立繪檔名沒掛），ID=128 只從 ITEM.INI 定義拿。

## 7. 道具 `items.type`（權威）

ITEM.INI 的 DEFINE 段有完整中文註解，直接抄：

| 代碼 | 符號 | 中文 |
|---:|---|---|
| 1 | `SWORD` | 劍 |
| 2 | `BLADE` | 刀 |
| 3 | `AXE` | 斧 |
| 4 | `HAMMER` | 鎚 |
| 5 | `SPEAR` | 矛 |
| 6 | `ROD` | 棍 |
| 7 | `STAFF` | 杖 |
| 8 | `WHISK` | 拂塵 |
| 9 | `HIDDEN_WEAPON` | 暗器 |
| 10 | `BOW` | 弓 |
| 11 | `GREAT_SWORD` | 倭刀 |
| 12 | `SHIELD` | 盾 |
| 13 | `STING` | 短劍 |
| 14 | `CLAW` | 爪 |
| 15 | `PUNCHER` | 指套 |
| 16 | `BOXING` | 拳套 |
| 17 | `HELMET` | 頭盔 |
| 18 | `ARMOR` | 盔甲 |
| 19 | `WING` | 翼 |
| 20 | `BOOT` | 鞋 |
| 21 | `HORSE` | 座騎 |
| 22 | `ORNAMENT` | 飾品 |
| 23 | `TALISMAN` | 護身符 |
| 24 | `POTION` | 藥 |
| 25 | `MATERIAL` | 原料 |
| 26 | `MAGIC` | 魔法（技能書） |
| 27 | `PRESCRIPTION` | 配方 |
| 28 | `MAGIC_FIGURE` | 法寶 |
| 29 | `BONUS` | 特別物品 |
| 30 | `MONEY` | 錢 |
| 31 | `ITEM_NPC` | NPC |
| 32 | `ITEM_PET` | 寵物 |
| 33 | `PET_ORNAMENT` | 寵物裝飾 |
| 34 | `BOT_PART` | 機關人零件 |
| 35 | `BOT_COREPART` | 機關核 |
| 36 | `ATTACK_ITEM` | 攻擊性道具 |
| 37 | `NORMAL_ITEM` | 一般道具 |
| 38 | `SCARCE_ITEM` | 珍貴道具 |
| 39 | `EVENT_ITEM` | 事件道具 |
| 40 | `HP_POTION` | 體力類藥品 |
| 41 | `MP_POTION` | 真氣類藥品 |
| 42 | `SP_POTION` | 行動類藥品 |
| 43 | `COMPOUND_POTION` | 複方類藥品 |
| 44 | `STATUS_POTION` | 狀態藥品 |
| 45 | `ENHANCE_POTION` | 輔助類藥品 |
| 46 | `ITEM_BOT` | 機關人娃娃 |
| 47 | `RETURN_SCROLL` | 傳送捲軸 |
| 48 | `CASTLE_ITEM` | 家族道具 |

> `items.type` 目前資料庫存的是**符號字串**（`BLADE`、`POTION` 等），不是數字代碼。上表按用途歸類用得上。

## 8. 狀態群組 `GS_*`（statusdef.ini）

技能 INI 的 `Group = 29` 類欄位對應到這張表。38 組、都有中文註解，直接列出以備未來顯示 buff/debuff 歸類：

| 代碼 | 符號 | 中文 |
|---:|---|---|
| 1 | `GS_BLADE_DMG_UP` | 殺氣 |
| 2 | `GS_ACCURACY_UP` | 冰心 |
| 3 | `GS_HPRECOVER_UP` | 針灸 |
| 4 | `GS_MOVESPEED_UP` | 加速 |
| 5 | `GS_NOMOVE_HPRECOVER_UP` | 調息 |
| 6 | `GS_NOMOVE_MPRECOVER_UP` | 調氣 |
| 7 | `GS_FIREDEF_UP` | 抗火 |
| 8 | `GS_WATERDEF_UP` | 抗水 |
| 9 | `GS_LIGHTNINGDEF_UP` | 抗雷 |
| 10 | `GS_EARTHDEF_UP` | 抗土 |
| 11 | `GS_KIND_IMMUE` | 抗魔 |
| 12 | `GS_MAGIC_ARMOR` | 咒甲 |
| 13 | `GS_SWORD_SPD_UP` | 劍舞 |
| 14 | `GS_BLIND` | 盲眼 |
| 15 | `GS_BROKEN_ARMOR` | 卸胄 |
| 16 | `GS_BROKEN_INVISIBLE` | 現形 |
| 17 | `GS_PARALYSIS` | 麻痺 |
| 18 | `GS_FREEZE` | 冰凍 |
| 19 | `GS_POISON` | 中毒 |
| 20 | `GS_MOVESPEED_DOWN` | 緩速 |
| 21 | `GS_DAMAGE_DOWN` | 攻降 |
| 22 | `GS_BURN` | 火燒 |
| 23 | `GS_VERTIGO` | 暈眩 |
| 24 | `GS_INVISIBLE` | 隱形 |
| 25 | `GS_DANCING_LEAF` | 葉刃 |
| 26 | `GS_MULTI_HIT` | 分身 |
| 27 | `GS_MANA_SHIELD` | 替身 |
| 28 | `GS_ICE_SHIELD` | 寒冰 |
| 29 | `GS_TORCH` | 照明 |
| 30 | `GS_MP_TO_HP` | 吐納 |
| 31 | `GS_DRAIN_HP` | 血契 |
| 32 | `GS_DRAIN_MP` | 靈契 |
| 33 | `GS_BERSERK` | 魔化 |
| 34 | `GS_SHAPECHANGE` | 易容 |
| 35 | `GS_GROUP_DMG_UP` | 激攻 |
| 36 | `GS_PROTECT_FROM_BAD` | 靈護 |
| 37 | `GS_REFLECT` | 反射 |
| 38 | `GS_STONE` | 石化 |

## 9. 重現方法

```bash
# 解碼單檔
iconv -f BIG-5 -t UTF-8 "E:/SETTING/setting/magicdef.ini"

# 怪物 Type 分布
iconv -f BIG-5 -t UTF-8 "E:/SETTING/MONSTER.INI" | awk '
  /^\[NPC\]/ { name=""; type=""; subtype="" }
  /^Name = / { sub(/^Name = /, ""); name=$0 }
  /^Type = / { sub(/^Type = /, ""); type=$0 }
  /^SubType = / { sub(/^SubType = /, ""); subtype=$0 }
  /^Flag = / { if (type != "") print type"\t"subtype"\t"name }
' | sort -u

# 技能 SkillType 分布
iconv -f BIG-5 -t UTF-8 "E:/SETTING/MAGIC.INI" | awk '
  /^\[MAGIC\]/ { sk=""; nm="" }
  /^Name = / && nm=="" { sub(/^Name = /, ""); nm=$0 }
  /^SkillType = / { sub(/^SkillType = /, ""); sk=$0 }
  /^Help = / { if (sk != "") print sk"\t"nm }
' | sort -u
```

---

**更新時機**：`E:\SETTING` 內容沒版本控，只要資料夾異動（例如遊戲更新後重新抓的原始檔）就該重新跑一次，對齊本文件。
