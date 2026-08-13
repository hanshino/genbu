"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { SlidersHorizontalIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioOption } from "@/components/ui/radio-group";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { HeroRosterDialog } from "@/components/heroes/hero-roster-dialog";
import { HeroTeamResultCard } from "@/components/heroes/hero-team-result-card";
import { HERO_BONUS_LABELS } from "@/lib/hero-bonus-labels";
import {
  HERO_BONUS_KEYS,
  optimizeHeroTeams,
  suggestHeroAdditions,
  type HeroBonusKey,
} from "@/lib/hero-team-optimizer";
import type { HeroCombination, HeroSummary } from "@/lib/types/hero";

const SLOT_OPTIONS = [1, 2, 3, 4] as const;
type Slots = (typeof SLOT_OPTIONS)[number];
type RosterMode = "all" | "custom";

interface Props {
  heroes: HeroSummary[];
  combinations: HeroCombination[];
}

export function HeroTeamBuilder({ heroes, combinations }: Props) {
  const [mainHeroId, setMainHeroId] = useState(heroes[0]?.id ?? 0);
  const [mode, setMode] = useState<RosterMode>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<HeroBonusKey>("hp");
  const [slots, setSlots] = useState<Slots>(2);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [query, setQuery] = useState("");

  const heroNames = useMemo(() => new Map(heroes.map((h) => [h.id, h.name])), [heroes]);
  const mainHero = heroes.find((h) => h.id === mainHeroId);

  // 受限模式的可使用集合一律包含主英雄，即使玩家沒勾到它。
  const availableIds = useMemo(() => {
    if (mode === "all") return null;
    const ids = new Set(selectedIds);
    ids.add(mainHeroId);
    return [...ids].sort((a, b) => a - b);
  }, [mode, selectedIds, mainHeroId]);

  const poolSize = availableIds ? availableIds.length : heroes.length;
  const companionCount = poolSize - 1;

  // 把整組設定當一個值 defer。deferred !== config 代表算的還是舊設定，
  // 此時不能把舊答案當成目前設定的答案顯示（見下方 showResults）。
  const config = useMemo(
    () => ({ mainHeroId, target, slots, availableIds }),
    [mainHeroId, target, slots, availableIds],
  );
  const deferred = useDeferredValue(config);
  const isPending = deferred !== config;

  const results = useMemo(
    () =>
      optimizeHeroTeams({
        heroes,
        combinations,
        mainHeroId: deferred.mainHeroId,
        slots: deferred.slots,
        target: deferred.target,
        ...(deferred.availableIds ? { availableHeroIds: deferred.availableIds } : {}),
      }),
    [heroes, combinations, deferred],
  );

  // 建議只在受限模式才有意義（全部可用時沒有未持有英雄），且成本較高，故與結果分開 memo。
  const suggestions = useMemo(() => {
    if (!deferred.availableIds) return [];
    return suggestHeroAdditions({
      heroes,
      combinations,
      mainHeroId: deferred.mainHeroId,
      slots: deferred.slots,
      target: deferred.target,
      availableHeroIds: deferred.availableIds,
    });
  }, [heroes, combinations, deferred]);

  const filteredHeroes = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return heroes;
    const asNum = Number(trimmed);
    const idMatch = Number.isInteger(asNum) ? asNum : null;
    return heroes.filter((h) => h.id === idMatch || h.name.includes(trimmed));
  }, [heroes, query]);

  const targetLabel = HERO_BONUS_LABELS[target];
  const notEnoughCompanions = companionCount < slots;
  // 重算期間不顯示任何舊答案：舊 results/suggestions 對應的是上一組設定，
  // 例如剛取消勾選的英雄還會留在裡面，那是錯的答案而不是「稍舊」的答案。
  const showResults = !isPending;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-4 rounded-lg border border-border/60 bg-card p-4 lg:sticky lg:top-20">
        <div className="flex items-baseline gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-medium">
            <SlidersHorizontalIcon className="size-4 text-muted-foreground" aria-hidden />
            配置條件
          </h2>
          <span className="text-xs text-muted-foreground">固定主英雄，另選 1–4 位</span>
        </div>

        <section className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">主英雄（固定）</h3>
          <Combobox
            items={filteredHeroes}
            filter={null}
            value={mainHero ?? null}
            itemToStringLabel={(h: HeroSummary) => h.name}
            inputValue={query}
            onInputValueChange={setQuery}
            onValueChange={(picked) => {
              if (!picked) return;
              setMainHeroId((picked as HeroSummary).id);
              setQuery("");
            }}
          >
            <ComboboxInput
              placeholder={mainHero ? mainHero.name : "搜尋英雄名稱或編號…"}
              aria-label="主英雄"
            />
            <ComboboxContent>
              <ComboboxEmpty>查無符合「{query.trim()}」的英雄</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(hero: HeroSummary) => (
                    <ComboboxItem key={hero.id} value={hero}>
                      <span className="flex-1 truncate">{hero.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{hero.id}</span>
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {mainHero && (
            <p className="text-xs text-muted-foreground">
              目前：{mainHero.name}
              <span className="ml-1.5 font-mono">#{mainHero.id}</span>
            </p>
          )}
        </section>

        <section className="rounded-lg border border-primary/50 bg-primary/5 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <UsersIcon className="size-4 text-primary" aria-hidden />
            可使用英雄
          </h3>
          <p className="mt-1 mb-2.5 text-xs text-muted-foreground">
            先決定哪些英雄真的在你手上，結果只會從這個範圍挑相惜英雄。
          </p>

          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as RosterMode)}
            aria-label="可使用英雄範圍"
            className="flex-col gap-1.5"
          >
            <RadioOption value="all" variant="card">
              <span className="font-medium">全部 {heroes.length} 位皆可用</span>
              <span className="block text-xs text-muted-foreground">
                不設限制，把整份名冊都當成可搭配對象
              </span>
            </RadioOption>
            <RadioOption value="custom" variant="card">
              <span className="font-medium">只用我勾選的英雄</span>
              <span className="block text-xs text-muted-foreground">
                依實際擁有的英雄計算，主英雄自動保留
              </span>
            </RadioOption>
          </RadioGroup>

          {mode === "custom" && (
            <div className="mt-2.5 space-y-2 border-t border-dashed border-primary/40 pt-2.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-base text-foreground">{poolSize}</span>{" "}
                位可使用（含主英雄）
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => setRosterOpen(true)}
              >
                管理可使用英雄
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">目標屬性（單選）</h3>
          <RadioGroup
            value={target}
            onValueChange={(value) => setTarget(value as HeroBonusKey)}
            aria-label="目標屬性"
          >
            {HERO_BONUS_KEYS.map((key) => (
              <RadioOption key={key} value={key} className="flex-1 basis-16">
                {HERO_BONUS_LABELS[key]}
              </RadioOption>
            ))}
          </RadioGroup>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">相惜英雄數量</h3>
          <RadioGroup
            value={slots}
            onValueChange={(value) => setSlots(value as Slots)}
            aria-label="相惜英雄數量"
          >
            {SLOT_OPTIONS.map((n) => (
              <RadioOption key={n} value={n} className="min-w-11 flex-1">
                {n} 位
              </RadioOption>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">含主英雄，隊伍最多 5 位。</p>
        </section>
      </aside>

      <section className="min-w-0 space-y-4">
        <p className="text-sm text-muted-foreground">
          固定主英雄，依「{targetLabel}」的連結加成總和排序，最多顯示 10 組。
        </p>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-4">
          <MetaCell label="主英雄" value={mainHero?.name ?? "—"} />
          <MetaCell label="可使用英雄" value={String(poolSize)} mono />
          <MetaCell label="目標屬性" value={targetLabel} />
          <MetaCell label="相惜英雄數量" value={String(slots)} mono />
        </dl>

        {/* aria-busy 標在結果容器上：重算期間容器內不留任何舊答案。 */}
        <div
          data-testid="hero-team-results"
          aria-busy={isPending}
          aria-live="polite"
          className="space-y-4"
        >
          {!showResults ? (
            <p className="rounded-lg border border-dashed border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              計算中…
            </p>
          ) : notEnoughCompanions ? (
            <EmptyState
              title="可使用英雄不足"
              tone="warn"
              body={`目前可搭配的英雄只有 ${Math.max(0, companionCount)} 位（不含主英雄），少於指定的 ${slots} 位。請放寬數量或多勾選幾位英雄。`}
              action={
                mode === "custom" ? (
                  <Button type="button" size="sm" onClick={() => setRosterOpen(true)}>
                    管理可使用英雄
                  </Button>
                ) : null
              }
            />
          ) : results.length === 0 ? (
            <EmptyState
              title="沒有可完整啟動的連結"
              tone="muted"
              body={`目前可使用的 ${poolSize} 位英雄中，找不到任何 hero_connect 能在 ${slots} 位相惜英雄的組合裡全員到齊。本站假設缺一位就不啟動，因此不會給部分加成。`}
              action={
                mode === "custom" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRosterOpen(true)}
                  >
                    管理可使用英雄
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              {results[0].targetScore === 0 && (
                <p className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  以下隊伍都有完整啟動的連結，但沒有一條連結帶「{targetLabel}
                  」加成，所以這一項全部是 0。可以換一個目標屬性再看。
                </p>
              )}
              <ol className="space-y-3">
                {results.map((result, index) => (
                  <li key={`${result.mainHeroId}-${result.companionIds.join("-")}`}>
                    <HeroTeamResultCard
                      result={result}
                      rank={index + 1}
                      target={deferred.target}
                      heroNames={heroNames}
                      poolSize={poolSize}
                    />
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        {showResults && suggestions.length > 0 && (
          <section className="space-y-2 rounded-lg border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-base font-medium">再多一位會更好</h2>
              <span className="text-xs text-muted-foreground">尚未勾選，不計入上方結果</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              以下英雄不在「可使用英雄」範圍內，完全沒有進入上方結果。這裡只是說明：如果手上多了這一位，
              {targetLabel}連結加成總和的上限會往哪裡走。
            </p>
            <ul className="divide-y divide-border/60">
              {suggestions.map((s) => (
                <li key={s.heroId} className="flex flex-wrap items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {heroNames.get(s.heroId) ?? `英雄 #${s.heroId}`}
                      <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                        #{s.heroId}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      可解鎖：{s.unlocked.map((c) => c.name).join("、")}；加入後{targetLabel}
                      最高可到 +{s.score.toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-mono font-normal">
                    +{s.gain.toLocaleString()}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2 rounded-lg border border-border/60 bg-card p-4">
          <h2 className="text-base font-medium">假設與範圍</h2>
          <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <li>
              <span className="text-foreground">hero_connect 全員到齊才啟動。</span>
              連結列出的英雄缺任何一位，這組加成就完全不計，不會按比例給。
            </li>
            <li>
              <span className="text-foreground">多組加成直接相加，是本站的計算假設。</span>
              遊戲內是否為線性疊加、是否有上限或遞減，資料中沒有記錄，也未經實測。
            </li>
            <li>
              <span className="text-foreground">資料中的 null 加成在計算時以 0 相加。</span>
              原始資料仍是 null，代表該連結沒有這項欄位值，不是資料庫寫著 0。
            </li>
            <li>
              <span className="text-foreground">不含等級、靈氣、英雄自身數值與變身能力。</span>
              這裡只算相惜連結帶來的八項加成，不是角色面板數值。
            </li>
            <li>
              連結的啟用條件、加成套用對象，以及成員是否需要同時出戰，資料中都沒有記錄，目前未知。
              排序結果不代表官方推薦或完整戰力比較。
            </li>
          </ul>
          <p className="pt-1 text-xs text-muted-foreground">
            英雄與連結原始欄位可在
            <Link
              href="/heroes"
              className="mx-1 underline underline-offset-2 hover:text-foreground"
            >
              英雄列表
            </Link>
            逐筆查看。
          </p>
        </section>
      </section>

      <HeroRosterDialog
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        heroes={heroes}
        mainHeroId={mainHeroId}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />
    </div>
  );
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-sm ${mono ? "font-mono tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}

function EmptyState({
  title,
  body,
  tone,
  action,
}: {
  title: string;
  body: string;
  tone: "warn" | "muted";
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`space-y-2 rounded-lg border border-dashed p-6 text-center ${
        tone === "warn" ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card"
      }`}
    >
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mx-auto max-w-prose text-xs leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="flex justify-center pt-1">{action}</div>}
    </div>
  );
}
