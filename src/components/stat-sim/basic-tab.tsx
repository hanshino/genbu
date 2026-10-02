"use client";

import { useState } from "react";
import { CheckIcon, CircleAlertIcon, CircleDashedIcon, PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SECTS } from "@/configs/stat-sim";
import { inferRebirthPoints, levelPoints, rebirthReward } from "@/lib/stat-sim";
import { EQUIP_SLOTS, SUB_SECT_CLANS, type CharacterV1, type SectId } from "@/lib/types/stat-sim";
import { cn } from "@/lib/utils";
import { SECT_OPTIONS, SUB_SECT_LABELS, fmt } from "./labels";

type Update = (fn: (c: CharacterV1) => CharacterV1) => void;

const REBIRTH_LEVELS = Array.from({ length: 41 }, (_, i) => 140 - i);
const ORDINAL = ["第一轉", "第二轉", "第三轉", "第四轉"];

export function BasicTab({ character, update }: { character: CharacterV1; update: Update }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-heading">基本資料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="門派" htmlFor="sim-sect">
            <Select
              value={String(character.sectId)}
              onValueChange={(v) => v && update((c) => ({ ...c, sectId: Number(v) as SectId }))}
            >
              <SelectTrigger id="sim-sect" className="w-full" aria-label="門派">
                <SelectValue>{(v: unknown) => SECTS[Number(v) as SectId]?.name ?? ""}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SECT_OPTIONS.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <LevelField key={character.id} character={character} update={update} />
        </div>

        <SubSects character={character} update={update} />
        <Rebirth key={character.id} character={character} update={update} />
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 font-heading text-xs tracking-[0.12em] text-muted-foreground after:h-px after:flex-1 after:bg-border">
      {children}
    </div>
  );
}

function LevelField({ character, update }: { character: CharacterV1; update: Update }) {
  const [draft, setDraft] = useState(String(character.level));
  const n = Number(draft);
  const valid = Number.isSafeInteger(n) && n >= 1 && n <= 300;
  return (
    <Field label="等級" htmlFor="sim-level">
      <Input
        id="sim-level"
        type="number"
        inputMode="numeric"
        min={1}
        className="text-right font-mono"
        value={draft}
        aria-invalid={!valid}
        onChange={(e) => {
          setDraft(e.target.value);
          const next = Number(e.target.value);
          if (Number.isSafeInteger(next) && next >= 1 && next <= 300) {
            update((c) => ({ ...c, level: next }));
          }
        }}
        onBlur={() => !valid && setDraft(String(character.level))}
      />
    </Field>
  );
}

function SubSects({ character, update }: { character: CharacterV1; update: Update }) {
  const full = character.subSects.length >= 2;
  return (
    <div>
      <SectionLabel>副門派（最多兩個）</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {SUB_SECT_CLANS.map((clan) => {
          const on = character.subSects.includes(clan);
          const disabled = !on && full;
          return (
            <label
              key={clan}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 text-sm transition-colors hover:bg-muted/50",
                on && "border-primary/40 bg-primary/[0.08] text-primary",
                disabled && "cursor-not-allowed opacity-45 hover:bg-card",
              )}
            >
              <Checkbox
                checked={on}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  update((c) => ({
                    ...c,
                    subSects: checked
                      ? [...c.subSects.filter((s) => s !== clan), clan].slice(0, 2)
                      : c.subSects.filter((s) => s !== clan),
                  }))
                }
              />
              {SUB_SECT_LABELS[clan]}
            </label>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleAlertIcon className="size-3.5" aria-hidden />
        {full ? "已選兩個，要換請先取消一個。" : `還可以再選 ${2 - character.subSects.length} 個。`}
      </p>
    </div>
  );
}

function Rebirth({ character, update }: { character: CharacterV1; update: Update }) {
  const [mode, setMode] = useState<"known" | "guess">("known");
  const [gameLeft, setGameLeft] = useState("");
  const levels = character.rebirthLevels ?? [];
  const setLevels = (next: number[]) =>
    update((c) => ({
      ...c,
      rebirthLevels: next,
      rebirthPoints: next.reduce((sum, lv) => sum + rebirthReward(lv), 0),
    }));

  const left = gameLeft.trim() === "" ? null : Number(gameLeft);
  const guess = inferRebirthPoints({
    level: character.level,
    attributes: character.attributes,
    remaining: left,
  });
  const worn = EQUIP_SLOTS.filter((s) => character.equipment[s]).length;
  const earned = levelPoints(character.level);
  const canApply = guess.status === "ok" && guess.total != null;

  return (
    <div>
      <SectionLabel>轉生紀錄</SectionLabel>
      <ToggleGroup
        aria-label="轉生紀錄輸入方式"
        value={[mode]}
        onValueChange={(v) => v[0] && setMode(v[0] as "known" | "guess")}
      >
        <ToggleGroupItem value="known">我知道轉生等級</ToggleGroupItem>
        <ToggleGroupItem value="guess">幫我推算</ToggleGroupItem>
      </ToggleGroup>

      {mode === "known" ? (
        <div className="mt-4 space-y-2">
          {levels.map((lv, i) => (
            <div
              key={i}
              className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
            >
              <span className="font-heading text-xs text-muted-foreground">{ORDINAL[i]}</span>
              <Select
                value={String(lv)}
                onValueChange={(v) =>
                  v && setLevels(levels.map((x, j) => (j === i ? Number(v) : x)))
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-full bg-card"
                  aria-label={`${ORDINAL[i]}等級`}
                >
                  <SelectValue>{(v: unknown) => `Lv ${String(v)}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REBIRTH_LEVELS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Lv {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="font-mono">
                {rebirthReward(lv)} 點
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`移除${ORDINAL[i]}`}
                onClick={() => setLevels(levels.filter((_, j) => j !== i))}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          {levels.length < 4 && (
            <Button variant="outline" size="sm" onClick={() => setLevels([...levels, 120])}>
              <PlusIcon />
              新增{ORDINAL[levels.length]}
            </Button>
          )}
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-muted-foreground">轉生點數總和</span>
              <span className="font-mono text-2xl font-semibold" data-testid="rebirth-sum">
                {character.rebirthPoints}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {levels.length
                ? levels.map((lv) => `Lv${lv}→${rebirthReward(lv)}`).join(" ＋ ")
                : character.rebirthPoints > 0
                  ? "沒有填每次的等級，這個總和是之前推算套用的。"
                  : "還沒轉生，或還沒填轉生紀錄。"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              每次轉生可選 Lv100–140，等級越高保留的點數越多。等級超過 140 一定已經四轉。
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            先填好裝備、被動（含成就）與手動加成，再在屬性視窗切到「含裝」，照遊戲裡的數字填六圍，扣除所有加成後推算才準。
          </p>
          <ul className="space-y-1.5">
            <Check done label="等級" meta={`Lv${character.level}`} />
            <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
              <Mark done={left != null && Number.isSafeInteger(left) && left >= 0} />
              <label htmlFor="sim-game-left">遊戲中的剩餘屬性點</label>
              <Input
                id="sim-game-left"
                type="number"
                inputMode="numeric"
                min={0}
                className="h-7 w-24 bg-card text-right font-mono"
                value={gameLeft}
                onChange={(e) => setGameLeft(e.target.value)}
              />
            </li>
            <Check
              done
              label="六圍（不含裝）"
              meta={Object.values(character.attributes).join(" / ")}
            />
            <Check done={worn > 0} label="裝備已填（請另確認被動與手動加成）" meta={`${worn} / ${EQUIP_SLOTS.length} 件`} />
          </ul>

          <div
            className={cn(
              "mt-4 rounded-lg border px-4 py-3",
              guess.status === "ok"
                ? "border-primary/30 bg-primary/[0.06]"
                : "border-border/60 bg-muted/40",
            )}
            data-testid="rebirth-guess"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-sm text-muted-foreground">推算轉生點數總和</span>
              <span className="font-mono text-2xl font-semibold">{guess.total ?? "—"}</span>
              <Badge variant={guess.status === "ok" ? "secondary" : "destructive"}>
                {guess.status === "ok" ? "合理" : guess.status === "check" ? "需檢查" : "資料不足"}
              </Badge>
              {guess.estimated && <Badge variant="outline">估計</Badge>}
            </div>
            {guess.total != null && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                加點成本 {fmt(guess.total - left! + earned)} ＋ 剩餘 {fmt(left!)} − 升級點數{" "}
                {fmt(earned)} ＝ {fmt(guess.total)}
              </p>
            )}
            {guess.reasons.map((r) => (
              <p key={r} className="mt-1.5 text-xs text-destructive">
                {r}
              </p>
            ))}
            <p className="mt-2 text-xs text-muted-foreground">
              只能推出總和，沒辦法拆出每次轉生的等級。
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={!canApply}
              onClick={() =>
                canApply &&
                update((c) => {
                  const next = { ...c, rebirthPoints: guess.total! };
                  delete next.rebirthLevels;
                  return next;
                })
              }
            >
              套用這個總和
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Mark({ done }: { done: boolean }) {
  return done ? (
    <CheckIcon className="size-4 text-primary" aria-label="已完成" />
  ) : (
    <CircleDashedIcon className="size-4 text-muted-foreground" aria-label="未完成" />
  );
}

function Check({ done, label, meta }: { done: boolean; label: string; meta: string }) {
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
      <Mark done={done} />
      <span>{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{meta}</span>
    </li>
  );
}
