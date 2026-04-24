// 依 tthol-line-bot 的 advance.config.js 14 個分類（技能書 item IDs），
// 剝掉書名的「N級」prefix dedup 成技能名，再查 magic 表反查技能資訊。
// 用途：產出「主流攻擊技能」清單給怪物頁的命中需求面板。
// 執行：node scripts/resolve-skill-picks.mjs

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const ADVANCE_CONFIG_PATH = path.resolve(
  projectRoot,
  "../tthol-line-bot/src/configs/advance.config.js",
);
const DB_PATH = path.resolve(projectRoot, "tthol.sqlite");

// classifyBooks: line-bot 用 /\d{1,2}級/ 剝掉書本級數得到技能名
function stripLevelPrefix(name) {
  return name.replace(/\d{1,2}級/, "");
}

const advanceConfig = require(ADVANCE_CONFIG_PATH);
const db = new Database(DB_PATH, { readonly: true });

// 族群分組（和 line-bot 的三張 bubble 對齊）
// 醫毒不列入 — 遊戲設計上狀態/治療類必定命中，無 func_hit_p1
const FAMILY = {
  人族: ["刀法", "惡術", "掌法", "劍法", "匕首"],
  曼陀羅: ["劍扇", "靈種", "劍刃", "劍氣"],
  獸族: ["法術", "野性", "禁術", "戰體"],
};

// 書名→技能名 的分類特殊規則：某些分類的 magic.name 是書名 stem 再加 suffix
// 靈種：書「N級熾炎獸」→ 技能「熾炎獸靈種」
const NAME_SUFFIX = {
  靈種: "靈種",
};

const getItemsByIds = (ids) => {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT id, name FROM items WHERE id IN (${placeholders})`).all(...ids);
};

// 同一個技能名通常只有一個玩家版本；但我們觀察到會有另外一個高 id、僅 Lv1-2、
// p1=500 的「特效版」（例如 落英紛飛 id=714 玩家版 vs id=1133 特效版）。
// 因此固定挑 MIN(id)：玩家版的 id 通常比較小。同時排除 BOSS 技能池 teacher=29。
const getPlayerSkillId = db.prepare(
  `SELECT MIN(id) AS id FROM magic WHERE name = ? AND (teacher IS NULL OR teacher != 29)`,
);

const getSkillAnchor = db.prepare(
  `SELECT id, name, level, func_hit_p1, target, skill_type, clan
   FROM magic
   WHERE id = ?
   ORDER BY level ASC
   LIMIT 1`,
);

// 同一個 id 各等級的 func_hit_p1（確認跨級是否同值；玩家版通常連續遞增）
const getHitDistribution = db.prepare(
  `SELECT level, func_hit_p1 FROM magic WHERE id = ? ORDER BY level ASC`,
);

// 攻擊技能條件：有 func_hit_p1（> 0），且 target 不是 SELF
function isAttackSkill(s) {
  if (s == null) return false;
  if (s.func_hit_p1 == null || s.func_hit_p1 <= 0) return false;
  if (s.target === "TARGET_SELF") return false;
  return true;
}

// 找出每個分類的技能名（stripped + deduped）
function resolveSkillNames(categoryIds) {
  const all = [...categoryIds.second, ...categoryIds.third];
  const books = getItemsByIds(all);
  const names = new Set();
  for (const b of books) names.add(stripLevelPrefix(b.name));
  return [...names];
}

const output = {};
const report = [];

for (const [family, categories] of Object.entries(FAMILY)) {
  for (const categoryTitle of categories) {
    const cfg = advanceConfig.find((c) => c.title === categoryTitle);
    if (!cfg) {
      report.push(`[警告] line-bot 找不到分類「${categoryTitle}」`);
      continue;
    }

    const bookStems = resolveSkillNames(cfg.id);
    const suffix = NAME_SUFFIX[categoryTitle] ?? "";
    const skillNames = bookStems.map((s) => `${s}${suffix}`);
    const attackSkills = [];
    const filteredOut = [];
    const missing = [];

    for (const name of skillNames) {
      const playerIdRow = getPlayerSkillId.get(name);
      if (!playerIdRow?.id) {
        missing.push(name);
        continue;
      }
      const row = getSkillAnchor.get(playerIdRow.id);
      if (!row) {
        missing.push(name);
        continue;
      }
      if (!isAttackSkill(row)) {
        filteredOut.push({
          name: row.name,
          reason:
            row.func_hit_p1 == null || row.func_hit_p1 <= 0
              ? "無命中率參數1"
              : row.target === "TARGET_SELF"
                ? "target=SELF"
                : "其他",
          func_hit_p1: row.func_hit_p1,
          target: row.target,
          skill_type: row.skill_type,
        });
        continue;
      }

      // 檢查同一個玩家版 id 各等級的 p1 分布
      const levels = getHitDistribution.all(row.id);
      const distinctHits = [...new Set(levels.map((l) => l.func_hit_p1))].sort((a, b) => a - b);
      const hitNote =
        distinctHits.length === 1 ? `${row.func_hit_p1}` : `${distinctHits.join("→")}（跨級成長）`;

      attackSkills.push({
        id: row.id,
        name: row.name,
        firstLevel: row.level,
        funcHitP1: row.func_hit_p1,
        hitNote,
        target: row.target,
        skillType: row.skill_type,
        clan: row.clan,
      });
    }

    output[`${family} / ${categoryTitle}`] = {
      attackSkills,
      filteredOut,
      missing,
    };

    report.push(
      `\n═══ ${family} / ${categoryTitle} ═══\n` +
        `攻擊技能 (${attackSkills.length}): ${attackSkills.map((s) => `${s.name}(p1=${s.hitNote})`).join("、")}\n` +
        (filteredOut.length > 0
          ? `已過濾 (${filteredOut.length}): ${filteredOut.map((s) => `${s.name}[${s.reason}]`).join("、")}\n`
          : "") +
        (missing.length > 0 ? `❌ magic 表查無 (${missing.length}): ${missing.join("、")}\n` : ""),
    );
  }
}

console.log(report.join(""));

// 寫一份 JSON 方便眼睛 diff
const outFile = path.resolve(projectRoot, ".omc/tmp/skill-picks-preview.json");
import fs from "node:fs";
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf-8");
console.log(`\n\n完整結果已寫入：${path.relative(projectRoot, outFile)}`);

// 同時產出可以直接進 repo 的 skill-picks.ts
const categoryOrder = Object.values(FAMILY).flat();
const picksByCategory = {};
const familyByCategory = {};
for (const [family, categories] of Object.entries(FAMILY)) {
  for (const c of categories) familyByCategory[c] = family;
}
for (const [key, v] of Object.entries(output)) {
  const [, category] = key.split(" / ");
  picksByCategory[category] = v.attackSkills.map((s) => ({
    id: s.id,
    name: s.name,
    firstLevel: s.firstLevel,
  }));
}

const tsLines = [
  "// AUTO-GENERATED by scripts/resolve-skill-picks.mjs — 不要手改",
  "// 來源：tthol-line-bot/src/configs/advance.config.js 的 14 個進階書分類（扣除醫毒，必中無命中率參數）",
  "// 只記技能 identity (id, name, firstLevel)；p1/target/level range 執行時從 magic 表撈。",
  "",
  "export type SkillSchool =",
  categoryOrder.map((c) => `  | "${c}"`).join("\n") + ";",
  "",
  'export type SkillFamily = "人族" | "曼陀羅" | "獸族";',
  "",
  "export interface SkillPick {",
  "  id: number;",
  "  name: string;",
  "  firstLevel: number;",
  "}",
  "",
  "export const SKILL_SCHOOL_FAMILY: Record<SkillSchool, SkillFamily> = {",
  ...categoryOrder.map((c) => `  ${c}: "${familyByCategory[c]}",`),
  "};",
  "",
  "export const SKILL_PICKS: Record<SkillSchool, readonly SkillPick[]> = {",
  ...categoryOrder.map(
    (c) =>
      `  ${c}: [\n` +
      picksByCategory[c]
        .map((p) => `    { id: ${p.id}, name: "${p.name}", firstLevel: ${p.firstLevel} },`)
        .join("\n") +
      `\n  ],`,
  ),
  "};",
  "",
  "// 便於依族分組顯示（Select 的 OptGroup 用）",
  "export const SKILL_FAMILY_ORDER: readonly SkillFamily[] = [\"人族\", \"曼陀羅\", \"獸族\"];",
  "",
  "export const SKILL_SCHOOLS_BY_FAMILY: Record<SkillFamily, readonly SkillSchool[]> = {",
  ...Object.entries(FAMILY).map(
    ([family, cats]) =>
      `  ${family}: [${cats.map((c) => `"${c}"`).join(", ")}] as const,`,
  ),
  "};",
  "",
];
const tsFile = path.resolve(projectRoot, "src/lib/constants/skill-picks.ts");
fs.writeFileSync(tsFile, tsLines.join("\n"), "utf-8");
console.log(`TS 常數已寫入：${path.relative(projectRoot, tsFile)}`);
console.log(`\n彙總：\n`);
let totalAttack = 0;
let totalFiltered = 0;
let totalMissing = 0;
for (const [k, v] of Object.entries(output)) {
  totalAttack += v.attackSkills.length;
  totalFiltered += v.filteredOut.length;
  totalMissing += v.missing.length;
  console.log(
    `  ${k.padEnd(16)}  攻擊 ${String(v.attackSkills.length).padStart(3)}  過濾 ${String(v.filteredOut.length).padStart(3)}  缺 ${v.missing.length}`,
  );
}
console.log(`\n  總計：攻擊 ${totalAttack}、過濾 ${totalFiltered}、magic 查無 ${totalMissing}`);

db.close();
