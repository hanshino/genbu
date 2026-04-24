import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { magicClanLabel } from "@/lib/constants/magic-clan";
import { magicTargetLabel } from "@/lib/constants/magic-target";
import { magicAttribLabel, MAGIC_ATTRIB_COLOR } from "@/lib/constants/magic-attrib";
import { magicSkillTypeLabel } from "@/lib/constants/magic-skill-type";
import type { Magic } from "@/lib/types/magic";

interface SkillDetailProps {
  skill: Magic;
  current: Magic;
  allLevels: readonly number[];
}

// 主要數值（有顯示價值的欄位）
const KEY_NUMERIC_FIELDS: readonly { key: keyof Magic; label: string; unit?: string }[] = [
  { key: "spend_mp", label: "真氣消耗" },
  { key: "spend_hp", label: "體力消耗" },
  { key: "func_dmg", label: "傷害參數" },
  { key: "func_hit", label: "命中率" },
  { key: "break_prob", label: "破招機率" },
  { key: "stun", label: "僵直時間", unit: "ms" },
  { key: "time", label: "持續時間", unit: "ms" },
  { key: "status_param", label: "效果參數" },
  { key: "status_prob", label: "狀態機率" },
  { key: "range", label: "施放距離" },
  { key: "hit_range", label: "命中範圍" },
  { key: "recharge_time", label: "冷卻時間" },
];

export function SkillDetail({ skill, current, allLevels }: SkillDetailProps) {
  const attribLabel = magicAttribLabel(skill.attrib);
  const attribColor = skill.attrib != null ? MAGIC_ATTRIB_COLOR[skill.attrib] : null;
  const maxLevel = Math.max(...allLevels);

  const numericRows = KEY_NUMERIC_FIELDS.map(({ key, label, unit }) => {
    const raw = current[key];
    if (raw == null || raw === 0) return null;
    return { key, label, value: Number(raw), unit };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{skill.name}</h1>
          {skill.clan && (
            <Badge variant="secondary" className="font-normal">
              {magicClanLabel(skill.clan)}
            </Badge>
          )}
          {skill.clan2 && skill.clan2 !== skill.clan && (
            <Badge variant="outline" className="font-normal">
              {magicClanLabel(skill.clan2)}
            </Badge>
          )}
          {attribLabel && (
            <Badge variant="outline" className={`font-normal ${attribColor ?? ""}`}>
              {attribLabel}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-mono">#{skill.id}</span>
          <span>{magicSkillTypeLabel(skill.skill_type)}</span>
          <span>{magicTargetLabel(skill.target)}</span>
          <span>最高 Lv {maxLevel}</span>
        </div>
      </header>

      <div className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2">
          <div className="text-sm font-medium">
            Lv {current.level} <span className="text-muted-foreground">/ 最高 {maxLevel}</span>
          </div>
          <LevelSwitcher skillId={skill.id} levels={allLevels} currentLevel={current.level} />
        </div>
        {numericRows.length > 0 ? (
          <div className="flex flex-wrap gap-2 p-4">
            {numericRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col items-center rounded-md border border-border/60 bg-muted/30 px-4 py-2.5 text-center"
              >
                <span className="font-mono text-sm font-semibold">
                  {row.value.toLocaleString()}
                  {row.unit && (
                    <span className="ml-0.5 text-xs text-muted-foreground">{row.unit}</span>
                  )}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{row.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">此等級無顯示中的數值欄位</div>
        )}
      </div>
    </section>
  );
}

function LevelSwitcher({
  skillId,
  levels,
  currentLevel,
}: {
  skillId: number;
  levels: readonly number[];
  currentLevel: number;
}) {
  if (levels.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-muted-foreground">切換等級</span>
      {levels.map((lv) => {
        const isActive = lv === currentLevel;
        return (
          <Link
            key={lv}
            href={`/skills/${skillId}?level=${lv}`}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "rounded-md border border-primary bg-primary/10 px-2 py-0.5 font-medium text-primary"
                : "rounded-md border border-border/60 px-2 py-0.5 text-muted-foreground hover:bg-muted/50"
            }
          >
            {lv}
          </Link>
        );
      })}
    </div>
  );
}
