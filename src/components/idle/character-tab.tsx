"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioOption } from "@/components/ui/radio-group";
import { swingPeriodSeconds } from "@/lib/attack-speed";
import { applyAllocation } from "@/lib/idle/allocation";
import { buildCombatant } from "@/lib/idle/character";
import { expToNext, killExp } from "@/lib/idle/engine";
import { currentStyle, stylesFor } from "@/lib/idle/job";
import { activeSkill, lockedSkills } from "@/lib/idle/skills";
import type { IdleData, IdleState } from "@/lib/idle/types";
import { NORMAL_ATTACK_NAME, killEstimate } from "@/lib/idle/view";
import type { IdleSceneAssets } from "@/lib/queries/idle";
import { nextCost } from "@/lib/stat-sim";
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type Attributes,
  type PanelResult,
} from "@/lib/types/stat-sim";
import { CharacterWindow } from "./character-window";
import { useWindowScale } from "./window-scale";

export type Draft = Partial<Record<AttributeKey, number>>;

const draftTotal = (draft: Draft) => ATTRIBUTE_KEYS.reduce((sum, k) => sum + (draft[k] ?? 0), 0);

export function CharacterTab({
  state,
  data,
  scene,
  draft,
  busy,
  error,
  onDraft,
  onConfirm,
  onWeapon,
}: {
  state: IdleState;
  data: IdleData;
  scene: IdleSceneAssets;
  draft: Draft;
  busy: boolean;
  error: string | null;
  onDraft: (draft: Draft) => void;
  onConfirm: () => void;
  onWeapon: (styleKey: string) => void;
}) {
  const layout = scene.attributeWindow;
  const [holder, scale] = useWindowScale<HTMLDivElement>(layout.width);
  const attrKey = ATTRIBUTE_KEYS.map((k) => state.attributes[k]).join(",");
  const draftKey = ATTRIBUTE_KEYS.map((k) => draft[k] ?? 0).join(",");

  // 面板與命中率用「含尚未確認的加點」預覽，加點前就看得到命中會變多少。
  const view = useMemo(() => {
    const attributes: Attributes = { ...state.attributes };
    for (const k of ATTRIBUTE_KEYS) attributes[k] += draft[k] ?? 0;
    const combatant = buildCombatant(
      { sectId: state.sectId, level: state.level, attributes },
      data,
    );
    const skill = activeSkill(data, state.level, combatant, state.skillId);
    const locked = lockedSkills(data, state.level, combatant);
    const monsters = [...new Set(data.spawns.map((s) => s.monsterId))]
      .sort((a, b) => a - b)
      .map((id) => data.monsters[id])
      .filter(Boolean)
      .map((m) => ({
        monster: m,
        est: killEstimate(
          combatant.attacker,
          m,
          skill ? skill.data : null,
          combatant.normalAttack.castTicks,
        ),
      }));
    // 視窗的攻速欄顯示放置引擎用的攻速等級（含門派欄位與武器加成），不是屬性模擬器的近似值。
    const panel: PanelResult = {
      ...combatant.panel,
      stats: {
        ...combatant.panel.stats,
        attack_speed: {
          ...combatant.panel.stats.attack_speed,
          value: combatant.normalAttack.level,
          estimated: false,
          estimateReasons: [],
        },
      },
    };
    return { combatant, skill, locked, monsters, panel };
    // state 每幀都是新物件；只有等級、六圍、技能、加點草稿會改變結果。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.level, state.sectId, state.skillId, attrKey, draftKey]);

  const { combatant, skill, locked, monsters, panel } = view;
  const spent = draftTotal(draft);
  const applied = spent > 0 ? applyAllocation(state, draft) : null;
  const cost = applied && !("error" in applied) ? applied.cost : 0;
  const remaining = state.unspentPoints - cost;
  const styles = stylesFor(state.sectId);
  const style = currentStyle(state);
  const lockedNote = styles.find((s) => !s.enabled && s.note)?.note;
  const need = expToNext(state.level, data);

  const skillLabel = skill
    ? `${data.skills.find((s) => s.id === skill.skillId)?.name ?? "招式"} Lv${skill.level}`
    : locked.length > 0
      ? `${NORMAL_ATTACK_NAME}（Lv${locked[0].learnLevel} 學招）`
      : NORMAL_ATTACK_NAME;

  const speedLevel = combatant.normalAttack.level;
  const attackSpeedHint = `攻速 Lv${speedLevel}：普通攻擊約 ${swingPeriodSeconds(speedLevel).toFixed(2)} 秒一次`;

  const addable = (key: AttributeKey) =>
    !("error" in applyAllocation(state, { ...draft, [key]: (draft[key] ?? 0) + 1 }));

  return (
    <div ref={holder} className="w-full">
      <div className="mx-auto max-w-full space-y-4" style={{ width: layout.width * scale }}>
        <CharacterWindow
          layout={layout}
          scale={scale}
          state={state}
          panel={panel}
          need={need}
          pending={draft}
          pointsLeft={remaining}
          busy={busy}
          canAdd={addable}
          costOf={(key) => nextCost(state.attributes[key] + (draft[key] ?? 0))}
          onAdd={(key) => onDraft({ ...draft, [key]: (draft[key] ?? 0) + 1 })}
          attackSpeedHint={attackSpeedHint}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-11 px-4" disabled={busy || spent === 0} onClick={onConfirm}>
            確認分配{spent > 0 ? `（${cost} 點）` : ""}
          </Button>
          <Button
            variant="outline"
            className="h-11 px-4"
            disabled={busy || spent === 0}
            onClick={() => onDraft({})}
          >
            取消
          </Button>
          <span className="text-muted-foreground text-xs">
            {state.unspentPoints > 0
              ? "按視窗裡的 + 加點，確認後才會生效。"
              : "升級時會得到新的屬性點。"}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <Card>
          <CardContent className="space-y-4">
            {styles.length > 0 && (
              <div className="space-y-2">
                <div
                  id="weapon-style-label"
                  className="text-muted-foreground text-[13px] font-medium"
                >
                  武器
                </div>
                <RadioGroup<string>
                  aria-labelledby="weapon-style-label"
                  value={style?.key ?? ""}
                  onValueChange={onWeapon}
                  disabled={busy}
                  className="grid grid-cols-2 gap-2"
                >
                  {styles.map((s) => (
                    <RadioOption
                      key={s.key}
                      value={s.key}
                      variant="card"
                      disabled={busy || !s.enabled}
                      className="min-h-11 items-center"
                    >
                      <span className="block font-medium">{s.label}</span>
                      <span className="text-muted-foreground block text-xs">{s.weaponName}</span>
                    </RadioOption>
                  ))}
                </RadioGroup>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {lockedNote ? `${lockedNote}。` : ""}
                  換武器會換成該武器的外觀與招式，技能改回自動。
                </p>
              </div>
            )}
            <dl className="grid gap-x-5 sm:grid-cols-2">
              {(styles.length > 0
                ? [["使用招式", skillLabel]]
                : [
                    ["武器", data.weapon?.name ?? "空手"],
                    ["普攻／技能", skillLabel],
                  ]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="border-border/60 flex justify-between gap-2 border-b py-1.5 text-sm"
                >
                  <dt className="text-muted-foreground shrink-0">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="bg-muted/40 border-border/60 space-y-1.5 rounded-lg border p-3 text-sm">
              <b className="text-muted-foreground text-[13px] font-medium">對這張地圖的怪</b>
              {monsters.map(({ monster, est }) => (
                <div key={monster.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    {monster.name}（Lv{monster.level}）
                    {killExp(state.level, monster) < monster.dropExp && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        等級差過大，經驗只剩 1
                      </span>
                    )}
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
    </div>
  );
}
