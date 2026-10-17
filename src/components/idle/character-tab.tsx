"use client";

import { PlusIcon } from "lucide-react";
import { useMemo } from "react";
import { STAT_LABELS } from "@/components/stat-sim/labels";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyAllocation } from "@/lib/idle/allocation";
import { buildCombatant } from "@/lib/idle/character";
import { activeSkill, lockedSkills } from "@/lib/idle/skills";
import type { IdleData, IdleState } from "@/lib/idle/types";
import { NORMAL_ATTACK_NAME, formatNumber, killEstimate } from "@/lib/idle/view";
import { nextCost } from "@/lib/stat-sim";
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from "@/lib/types/stat-sim";

export type Draft = Partial<Record<AttributeKey, number>>;

const HINTS: Record<AttributeKey, string> = {
  str: "物攻、傷害",
  pow: "內勁、真氣",
  vit: "生命、防禦",
  agi: "閃躲",
  dex: "命中、重擊",
  wis: "特殊加成",
};

const draftTotal = (draft: Draft) => ATTRIBUTE_KEYS.reduce((sum, k) => sum + (draft[k] ?? 0), 0);

function formatValue(value: number | null): string {
  return value == null ? "—" : formatNumber(Math.floor(value));
}

export function CharacterTab({
  state,
  data,
  draft,
  busy,
  error,
  onDraft,
  onAuto,
  onConfirm,
}: {
  state: IdleState;
  data: IdleData;
  draft: Draft;
  busy: boolean;
  error: string | null;
  onDraft: (draft: Draft) => void;
  onAuto: () => void;
  onConfirm: () => void;
}) {
  const attrKey = ATTRIBUTE_KEYS.map((k) => state.attributes[k]).join(",");
  const draftKey = ATTRIBUTE_KEYS.map((k) => draft[k] ?? 0).join(",");

  // 面板與命中率用「含尚未確認的加點」預覽，加點前就看得到命中會變多少。
  const view = useMemo(() => {
    const attributes: Attributes = { ...state.attributes };
    for (const k of ATTRIBUTE_KEYS) attributes[k] += draft[k] ?? 0;
    const combatant = buildCombatant({ sectId: state.sectId, level: state.level, attributes }, data);
    const skill = activeSkill(data, state.level, combatant, state.skillId);
    const locked = lockedSkills(data, state.level, combatant);
    const monsters = [...new Set(data.spawns.map((s) => s.monsterId))]
      .sort((a, b) => a - b)
      .map((id) => data.monsters[id])
      .filter(Boolean)
      .map((m) => ({ monster: m, est: killEstimate(combatant.attacker, m, skill ? skill.data : null) }));
    return { combatant, skill, locked, monsters };
    // state 每幀都是新物件；只有等級、六圍、技能、加點草稿會改變結果。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.level, state.sectId, state.skillId, attrKey, draftKey]);

  const { combatant, skill, locked, monsters } = view;
  const spent = draftTotal(draft);
  const applied = spent > 0 ? applyAllocation(state, draft) : null;
  const cost = applied && !("error" in applied) ? applied.cost : 0;
  const remaining = state.unspentPoints - cost;
  const stat = (key: keyof typeof combatant.panel.stats) => combatant.panel.stats[key].value;

  const skillLabel = skill
    ? `${data.skills.find((s) => s.id === skill.skillId)?.name ?? "招式"} Lv${skill.level}`
    : locked.length > 0
      ? `${NORMAL_ATTACK_NAME}（Lv${locked[0].learnLevel} 學招）`
      : NORMAL_ATTACK_NAME;

  const panel: [string, string][] = [
    [STAT_LABELS.atk, formatValue(stat("atk"))],
    [STAT_LABELS.matk, formatValue(stat("matk"))],
    [STAT_LABELS.hit, formatValue(stat("hit"))],
    [STAT_LABELS.critical, `${formatValue(stat("critical"))}%`],
    ["武器", data.weapon?.name ?? "空手"],
    ["普攻／技能", skillLabel],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>屬性分配</CardTitle>
          <CardAction className="text-muted-foreground text-sm">
            剩餘 <b className={remaining > 0 ? "text-primary" : "text-foreground"}>{remaining}</b> 點
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="divide-border/60 divide-y">
            {ATTRIBUTE_KEYS.map((key) => {
              const added = draft[key] ?? 0;
              const next = applyAllocation(state, { ...draft, [key]: added + 1 });
              const canAdd = !("error" in next);
              const value = state.attributes[key] + added;
              return (
                <div key={key} className="flex items-center gap-3 py-1.5">
                  <span className="w-12 shrink-0 font-medium">{STAT_LABELS[key]}</span>
                  <span className="w-10 shrink-0 text-right text-lg tabular-nums">
                    {value}
                    {added > 0 && <span className="text-primary block text-[10px] leading-none">+{added}</span>}
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 text-xs">{HINTS[key]}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">下一點 {nextCost(value)}</span>
                  <Button
                    variant="outline"
                    className="size-11 shrink-0"
                    aria-label={`加一點${STAT_LABELS[key]}`}
                    disabled={!canAdd || busy}
                    onClick={() => onDraft({ ...draft, [key]: added + 1 })}
                  >
                    <PlusIcon className="size-[18px]" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button className="h-11 px-4" disabled={busy || state.unspentPoints === 0} onClick={onAuto}>
              依門派自動配點
            </Button>
            <Button variant="outline" className="h-11 px-4" disabled={busy || spent === 0} onClick={onConfirm}>
              確認分配{spent > 0 ? `（${cost} 點）` : ""}
            </Button>
            {spent > 0 && (
              <Button variant="ghost" className="h-11 px-4" disabled={busy} onClick={() => onDraft({})}>
                取消
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>角色面板</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-5">
            {panel.map(([label, value]) => (
              <div key={label} className="border-border/60 flex justify-between gap-2 border-b py-1.5 text-sm">
                <dt className="text-muted-foreground shrink-0">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="bg-muted/40 border-border/60 space-y-1.5 rounded-lg border p-3 text-sm">
            <b className="text-muted-foreground text-[13px] font-medium">對這張地圖的怪</b>
            {monsters.map(({ monster, est }) => (
              <div key={monster.id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {monster.name}（Lv{monster.level}）
                </span>
                <span className="tabular-nums">
                  {est.seconds == null
                    ? `命中 ${Math.round(est.hitPct)}% · 命中不足`
                    : `命中 ${Math.round(est.hitPct)}% · 約 ${est.seconds.toFixed(1)} 秒一隻`}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
