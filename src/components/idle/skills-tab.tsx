"use client";

import { LockIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioOption } from "@/components/ui/radio-group";
import { buildCombatant } from "@/lib/idle/character";
import { lockedSkills, skillOptions } from "@/lib/idle/skills";
import type { IdleData, IdleState } from "@/lib/idle/types";
import { NORMAL_ATTACK_NAME, killEstimate } from "@/lib/idle/view";
import { ATTRIBUTE_KEYS } from "@/lib/types/stat-sim";

const NORMAL = "normal";
/** 只列最近會解鎖的幾招，後面的等級還很遠。 */
const LOCKED_SHOWN = 5;

function seconds(value: number | null): string {
  return value == null ? "命中不足" : `約 ${value.toFixed(1)} 秒一隻`;
}

export function SkillsTab({
  state,
  data,
  busy,
  onPick,
}: {
  state: IdleState;
  data: IdleData;
  busy: boolean;
  /** null = 改回自動（取傷害最高的招）。 */
  onPick: (skillId: number | null) => void;
}) {
  const attrKey = ATTRIBUTE_KEYS.map((k) => state.attributes[k]).join(",");
  const view = useMemo(() => {
    const combatant = buildCombatant(state, data);
    const choice = skillOptions(data, state.level, combatant);
    const locked = lockedSkills(data, state.level, combatant);
    // 以出現最多的怪當參考（MVP 地圖兩種怪權重相同時取第一種）。
    const weights = new Map<number, number>();
    for (const s of data.spawns) weights.set(s.monsterId, (weights.get(s.monsterId) ?? 0) + s.weight);
    const refId = [...weights].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    const ref = refId != null ? data.monsters[refId] : undefined;
    const rows = choice.options.map((o) => {
      const row = data.skills.find((s) => s.id === o.skillId)?.levels.find((l) => l.level === o.level) ?? null;
      return { option: o, est: ref && row ? killEstimate(combatant.attacker, ref, row) : null };
    });
    const normal = ref ? killEstimate(combatant.attacker, ref, null) : null;
    return { choice, locked, rows, ref, normal, attacker: combatant.attacker };
    // state 的內容只在等級、六圍、技能改變時才影響結果；每幀都會是新物件，所以用這幾個值當依賴。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.level, attrKey, state.skillId]);

  const { choice, locked, rows, ref, normal } = view;
  const hasSkills = choice.options.length > 0;
  const activeId = hasSkills ? (state.skillId != null && choice.options.some((o) => o.skillId === state.skillId) ? state.skillId : choice.defaultSkillId) : null;
  const weaponName = data.weapon?.name ?? "空手";
  const refName = ref?.name.replace(/^▲/, "") ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>掛機使用的招式</CardTitle>
        <CardDescription>一次一招。預設自動選傷害最高的招式。</CardDescription>
      </CardHeader>
      <CardContent className="max-w-2xl space-y-2">
        <RadioGroup
          aria-label="掛機招式"
          className="flex-col gap-2"
          value={activeId == null ? NORMAL : String(activeId)}
          disabled={busy}
          onValueChange={(v) => {
            if (v !== NORMAL) onPick(Number(v));
          }}
        >
          <RadioOption value={NORMAL} variant="card" disabled={hasSkills} className="min-h-11">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="flex flex-col">
                <b className="text-sm">{NORMAL_ATTACK_NAME}</b>
                <span className="text-muted-foreground text-xs">
                  Lv1 起 · {weaponName}
                  {hasSkills ? " · 有招式可用時不使用" : ""}
                </span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {normal ? `${seconds(normal.seconds)}${refName}` : ""}
              </span>
            </span>
          </RadioOption>
          {rows.map(({ option, est }) => (
            <RadioOption key={option.skillId} value={String(option.skillId)} variant="card" className="min-h-11">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <b className="text-sm">{option.name}</b>
                    {state.skillId == null && option.skillId === choice.defaultSkillId && (
                      <Badge variant="secondary">自動</Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Lv{option.level} · {option.hits} 段 · {weaponName}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {est ? `${seconds(est.seconds)}${refName}` : ""}
                </span>
              </span>
            </RadioOption>
          ))}
        </RadioGroup>

        {locked.slice(0, LOCKED_SHOWN).map((s) => (
          <div
            key={s.skillId}
            className="border-border/60 bg-muted/50 text-muted-foreground flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm"
          >
            <LockIcon className="size-4 shrink-0" aria-hidden />
            <span className="flex flex-col">
              <b className="text-foreground/70 text-sm">{s.name}</b>
              <span className="text-xs">Lv{s.learnLevel} 可學</span>
            </span>
          </div>
        ))}

        {locked.length > LOCKED_SHOWN && (
          <p className="text-muted-foreground px-1 text-xs">另有 {locked.length - LOCKED_SHOWN} 招在更高等級解鎖。</p>
        )}

        {state.skillId != null && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onPick(null)}>
            改回自動選招
          </Button>
        )}
        <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
          內力消耗與多招輪替在下一階段開放。
        </p>
      </CardContent>
    </Card>
  );
}
