"use client";

import { useState } from "react";
import { CircleAlertIcon, LayersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTS } from "@/configs/stat-sim";
import { WEAPON_TYPE_NAMES } from "@/configs/stat-sim-passives";
import { collectionLevels, passiveName } from "@/lib/stat-sim";
import type { CharacterV1, GameData, PassiveDef } from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { BonusRows } from "./bonus-rows";
import { SUB_SECT_LABELS, formatBonus, maxLearnable, selectOnFocus, typeLabel } from "./labels";

type Update = (fn: (c: CharacterV1) => CharacterV1) => void;

interface Row {
  passive: PassiveDef;
  /** 不生效的原因；null = 生效 */
  inactive: string | null;
  /** 武器不符但等級照留 */
  weaponMiss: boolean;
}

interface Group {
  id: string;
  title: string;
  rows: Row[];
}

/** 依主／副門派分組；不屬於目前門派但有等級的技能留在組裡變灰，等級不清掉。 */
function buildGroups(
  character: CharacterV1,
  passives: PassiveDef[],
  weaponTypes: string[],
): Group[] {
  const mainClan = SECTS[character.sectId].mainClan;
  const level = (p: PassiveDef) => character.passiveLevels[p.id] ?? 0;
  const row = (passive: PassiveDef, clanOK: boolean, clanReason: string): Row => {
    const weaponMiss =
      !!passive.weaponReq && !passive.weaponReq.some((t) => weaponTypes.includes(t));
    // 有 weaponReqStats 的技能武器不符時只有部分加成失效，整列不變灰
    const fullMiss = weaponMiss && !passive.weaponReqStats;
    return { passive, inactive: !clanOK ? clanReason : fullMiss ? "武器不符" : null, weaponMiss };
  };
  const main = passives
    // 入門弟子技能（怒擊）轉職後不計入面板，舊匯入留著等級也不列出來。
    .filter((p) => p.group === "main" && p.clan !== "CLASS_CHILD" && (p.clan === mainClan || level(p) > 0))
    .map((p) => row(p, p.clan === mainClan, "不是目前的主門派"));
  const sub = passives
    .filter(
      (p) => p.group === "sub" && (character.subSects.some((c) => c === p.clan) || level(p) > 0),
    )
    .map((p) =>
      row(
        p,
        character.subSects.some((c) => c === p.clan),
        "沒有選這個副門派",
      ),
    );
  const plain = (g: PassiveDef["group"]) =>
    passives.filter((p) => p.group === g).map((p) => row(p, true, ""));
  const subNames = character.subSects.map((c) => SUB_SECT_LABELS[c]).join(" / ");
  return [
    { id: "main", title: `主門派（${SECTS[character.sectId].name}）`, rows: main },
    { id: "sub", title: subNames ? `副門派（${subNames}）` : "副門派", rows: sub },
    { id: "common", title: "通用", rows: plain("common") },
    { id: "guild", title: "家族", rows: plain("guild") },
  ];
}

export function PassivesTab({
  character,
  data,
  weaponTypes,
  update,
}: {
  character: CharacterV1;
  data: GameData;
  weaponTypes: string[];
  update: Update;
}) {
  const groups = buildGroups(character, data.passives, weaponTypes);
  const collection = data.passives.filter((p) => p.group === "collection");
  const achievements = data.passives.filter((p) => p.group === "achievement");
  const [collectionValue, setCollectionValue] = useState("");
  const achievementMax = (p: PassiveDef) => Math.min(p.maxLevel, p.obtainableMax ?? 0);
  const setLevel = (id: number, lv: number) =>
    update((c) => ({ ...c, passiveLevels: { ...c.passiveLevels, [id]: lv } }));
  const fill = (rows: Row[]) =>
    update((c) => {
      const passiveLevels = { ...c.passiveLevels };
      for (const { passive } of rows) {
        const best = maxLearnable(passive.learnLevels, c.level);
        if (best > 0) passiveLevels[passive.id] = best;
      }
      return { ...c, passiveLevels };
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-heading">被動技能</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => fill(groups.flatMap((g) => g.rows))}>
              <LayersIcon />
              全部點滿
            </Button>
            <p className="text-xs text-muted-foreground">
              只點到目前等級學得到的最高級。目前武器：
              <b className="font-medium text-foreground">
                {weaponTypes.length ? weaponTypes.map(typeLabel).join("、") : "沒有裝備武器"}
              </b>
            </p>
          </div>

          {groups.map((g) => (
            <section
              key={g.id}
              className="@container overflow-hidden rounded-lg border border-border/60"
              aria-label={g.title}
            >
              <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
                <h3 className="font-heading text-sm font-semibold">{g.title}</h3>
                {g.rows.length > 0 && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => fill(g.rows)}
                  >
                    全滿
                  </Button>
                )}
              </header>
              {g.rows.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  {g.id === "sub" ? "還沒選副門派。" : "沒有會影響面板的被動。"}
                </p>
              ) : (
                g.rows.map((r) => (
                  <PassiveRow
                    key={r.passive.id}
                    row={r}
                    level={character.passiveLevels[r.passive.id] ?? 0}
                    charLevel={character.level}
                    onChange={(lv) => setLevel(r.passive.id, lv)}
                  />
                ))
              )}
            </section>
          ))}
        </CardContent>
      </Card>

      {(["collection", "achievement"] as const).map((group) => {
        const rows = group === "collection" ? collection : achievements;
        const title = group === "collection" ? "收藏" : "成就";
        return (
          <Card key={group} aria-label={title}>
            <CardHeader className="border-b">
              <CardTitle className="font-heading">{title}</CardTitle>
              {group === "achievement" && (
                <CardAction>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        passiveLevels: {
                          ...c.passiveLevels,
                          ...Object.fromEntries(achievements.map((p) => [p.id, achievementMax(p)])),
                        },
                      }))
                    }
                  >
                    全滿
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="@container space-y-3">
              <p className="text-xs text-muted-foreground">
                {group === "collection"
                  ? "輸入收藏值會自動帶入各項等級，也可以逐項調整。收藏值本身不會存檔。"
                  : "上限是目前已開放成就的獎勵總和；查不到取得方式的項目上限為 0。"}
              </p>
              {group === "collection" && (
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="sim-collection-value"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    收藏值
                  </label>
                  <Input
                    id="sim-collection-value"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    className="h-8 w-32 text-right font-mono"
                    value={collectionValue}
                    disabled={!data.collectionThresholds?.length}
                    onFocus={selectOnFocus}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCollectionValue(text);
                      const n = Number(text);
                      if (text.trim() !== "" && Number.isSafeInteger(n) && n >= 0) {
                        update((c) => ({
                          ...c,
                          passiveLevels: {
                            ...c.passiveLevels,
                            ...collectionLevels(n, data.collectionThresholds ?? []),
                          },
                        }));
                      }
                    }}
                  />
                </div>
              )}
              {/* 跟上面技能組同一套樣式：外框 + 細分隔線，寬度夠時排兩欄 */}
              <div className="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 @md:grid-cols-2">
                {rows.map((p) => {
                  const lv = character.passiveLevels[p.id] ?? 0;
                  const max = group === "achievement" ? achievementMax(p) : p.maxLevel;
                  const unavailable = group === "achievement" && max === 0 && lv === 0;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "grid grid-cols-[28px_minmax(0,1fr)_76px] items-center gap-2.5 bg-card px-3 py-2",
                        unavailable && "bg-muted/40",
                      )}
                    >
                      <span className={cn(unavailable && "opacity-45")}>
                        <SkillIcon url={p.iconUrl} size={28} />
                      </span>
                      <div className={cn("min-w-0", unavailable && "opacity-60")}>
                        <div className="truncate text-sm font-medium" title={passiveName(p, lv)}>
                          {passiveName(p, lv)}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {lv > 0
                            ? formatBonus(p.cumulative[lv] ?? {})
                            : unavailable
                              ? "查不到取得方式"
                              : `最高 Lv${max}`}
                          {/* 成就有兩組同名技能，附上技能編號才分得出來 */}
                          {group === "achievement" && (
                            <span className="ml-1.5 font-mono opacity-70">#{p.id}</span>
                          )}
                        </div>
                      </div>
                      {group === "achievement" ? (
                        <Select
                          value={String(lv)}
                          disabled={unavailable}
                          onValueChange={(value) => value != null && setLevel(p.id, Number(value))}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-full min-w-0 bg-card px-2"
                            aria-label={`${p.name}等級`}
                          >
                            <SelectValue>{(v: unknown) => `Lv${String(v)}`}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {lv > max && (
                              <SelectItem value={String(lv)} disabled>
                                Lv{lv}（超過目前可取得上限）
                              </SelectItem>
                            )}
                            {Array.from({ length: max + 1 }, (_, i) => max - i).map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                Lv{n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={p.maxLevel}
                          aria-label={`${p.name}等級`}
                          className="h-7 text-right font-mono"
                          value={lv}
                          onFocus={selectOnFocus}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isSafeInteger(n)) {
                              setCollectionValue("");
                              setLevel(p.id, Math.max(0, Math.min(p.maxLevel, n)));
                            }
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-heading">英雄 / 陣法 / 其他手動加值</CardTitle>
        </CardHeader>
        <CardContent className="@container space-y-4">
          {character.meridianPlan && !data.meridians && (
            <p className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
              這隻角色有經脈配點，但經脈加成尚未計入面板。
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            直接加在最終數值上，不經過六圍公式放大。陣法效果還沒建檔，請填遊戲裡實測的數字。
            「其他」放找不到來源的加成，例如伺服器端給角色的體力。
          </p>
          <div className="grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-3">
            {MANUAL_GROUPS.map(([k, label]) => (
              <div key={k}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
                <BonusRows
                  label={label}
                  value={character.manual[k] ?? {}}
                  onChange={(bonus) =>
                    update((c) => ({ ...c, manual: { ...c.manual, [k]: bonus } }))
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const MANUAL_GROUPS = [
  ["hero", "英雄"],
  ["formation", "陣法"],
  ["other", "其他"],
] as const;

const ANY_WEAPON = WEAPON_TYPE_NAMES.filter((t) => t !== "SHIELD");
/** 「任何武器」在資料裡是列出全部武器類型，顯示時收成一句。 */
const weaponReqText = (req: string[]) =>
  ANY_WEAPON.every((t) => req.includes(t)) ? "任何武器" : req.map(typeLabel).join(" / ");

function SkillIcon({ url, size }: { url: string | null; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="rounded-md border border-border/60 bg-muted [image-rendering:pixelated]"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="rounded-md border border-border/60 bg-muted"
      style={{ width: size, height: size }}
    />
  );
}

function PassiveRow({
  row,
  level,
  charLevel,
  onChange,
}: {
  row: Row;
  level: number;
  charLevel: number;
  onChange: (lv: number) => void;
}) {
  const { passive: p, inactive, weaponMiss } = row;
  const locked = (lv: number) => p.learnLevels[lv] > charLevel;
  const bonus = { ...(p.cumulative[level] ?? {}) };
  if (weaponMiss) for (const key of p.weaponReqStats ?? []) delete bonus[key];
  const effect = level > 0 ? formatBonus(bonus) : "";
  return (
    <div
      className={cn(
        "grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2 last:border-b-0 @md:grid-cols-[32px_minmax(0,1fr)_104px_minmax(88px,auto)]",
        inactive && "bg-muted/40",
      )}
      data-testid={`passive-${p.id}`}
    >
      <span className={cn(inactive && "opacity-45")}>
        <SkillIcon url={p.iconUrl} size={32} />
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium">
        <span className={cn(inactive && "opacity-45")}>{passiveName(p, level)}</span>
        {p.weaponReq && (
          <Badge variant={weaponMiss ? "destructive" : "secondary"} className="font-normal">
            需裝備 {weaponReqText(p.weaponReq)}
          </Badge>
        )}
        {inactive && inactive !== "武器不符" && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {inactive}
          </Badge>
        )}
      </div>
      <Select value={String(level)} onValueChange={(v) => v != null && onChange(Number(v))}>
        <SelectTrigger size="sm" className="w-24 bg-card sm:w-full" aria-label={`${p.name}等級`}>
          <SelectValue>{(v: unknown) => `Lv${String(v)}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: p.maxLevel + 1 }, (_, i) => p.maxLevel - i).map((lv) => (
            <SelectItem key={lv} value={String(lv)} disabled={locked(lv) && lv !== level}>
              Lv{lv}
              {locked(lv) && (
                <span className="text-xs text-muted-foreground">
                  未開放（Lv{p.learnLevels[lv]} 學）
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span
        className={cn(
          "col-span-full text-right font-mono text-xs text-muted-foreground @md:col-span-1",
          inactive && "opacity-60",
        )}
      >
        {inactive && level > 0 ? "未生效" : effect || "—"}
      </span>
    </div>
  );
}
