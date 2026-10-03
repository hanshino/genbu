import Link from "next/link";
import { ArrowRightIcon, CrownIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { TrainingDropList } from "@/components/maps/training-drop-list";
import { cn } from "@/lib/utils";
import type { HitRange, SpotHit, TrainingDrop, TrainingSpotView } from "@/lib/training-spots";
import type { TrainingSpotMonster } from "@/lib/types/monster-spawn";

function levelRange(min: number, max: number) {
  return min === max ? `Lv ${min}` : `Lv ${min} – ${max}`;
}

function formatRatio(ratio: number | null) {
  if (ratio == null) return "";
  return ratio >= 100 ? Math.round(ratio).toString() : ratio.toFixed(0);
}

function rangeText(r: HitRange) {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

/**
 * 立繪格：統一 56×64 容器 + object-contain（原圖 48×65 到 177×187 都有，不可變形）。
 * 菁英加鎏金框；閃躲最高、決定命中需求的那隻閃躲數字用朱砂色。
 */
function MonsterCell({ monster, isTop }: { monster: TrainingSpotMonster; isTop: boolean }) {
  return (
    <li className="w-16 shrink-0">
      <Link
        href={`/monsters/${monster.npcId}`}
        title={
          monster.elite
            ? `菁英：HP 約為本圖其他怪物中位數的 ${formatRatio(monster.hpRatio)} 倍`
            : undefined
        }
        className="flex flex-col items-center gap-1 rounded-md py-1 text-center transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {/* 菁英標籤疊在立繪上，不另佔一行：同排怪物的等級、名稱、閃躲才會對齊 */}
        <span className="relative">
          <EntityPortrait
            image={monster.image}
            alt={monster.name}
            size="md"
            className={cn(
              monster.elite
                ? "border-chart-4/70 bg-chart-4/10"
                : monster.image
                  ? "border-0 bg-transparent"
                  : "border-dashed bg-muted/50",
              "[&_img]:drop-shadow-[0_2px_3px_rgb(0_0_0/0.3)]",
            )}
          />
          {monster.elite && (
            <span className="absolute -top-1 -left-1 inline-flex items-center gap-0.5 rounded-sm border border-chart-4/60 bg-card px-1 text-[0.55rem] leading-tight font-semibold text-chart-4 shadow-xs">
              <CrownIcon className="size-2.5" aria-hidden />
              菁英
            </span>
          )}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "h-4 rounded-md px-1.5 font-mono text-[0.65rem]",
            monster.elite
              ? "border-chart-4/40 bg-chart-4/10 text-chart-4"
              : "border-primary/30 bg-primary/10 text-primary",
          )}
        >
          {monster.level}
        </Badge>
        <span className="line-clamp-2 min-h-[2.2em] text-[0.63rem] leading-[1.1] text-muted-foreground">
          {monster.name}
        </span>
        <span
          className={cn(
            "font-mono text-[0.6rem]",
            isTop ? "font-semibold text-primary" : "text-muted-foreground",
          )}
        >
          閃 {monster.dodge ?? "—"}
        </span>
      </Link>
    </li>
  );
}

function HitBlock({
  hit,
  school,
  onlyElite,
}: {
  hit: SpotHit;
  school: string;
  onlyElite: boolean;
}) {
  const { main } = hit;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border/60 px-3.5 py-3">
      <h4 className="text-xs font-normal text-muted-foreground">
        需撐命中（{school}
        {onlyElite ? "，以菁英計算" : "，一般怪"}）
      </h4>
      {main ? (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          <p className="font-mono text-3xl leading-none font-semibold tabular-nums">
            {main.min}
            {main.max !== main.min && (
              <span className="text-base font-normal text-muted-foreground"> – {main.max}</span>
            )}
          </p>
          <div className="flex min-w-0 flex-col text-xs text-muted-foreground">
            <span>
              <b className="font-medium text-foreground">{main.minSkill}</b>{" "}
              <span className="font-mono">{main.min}</span>
              {main.max !== main.min && (
                <>
                  {" · "}
                  <b className="font-medium text-foreground">{main.maxSkill}</b>{" "}
                  <span className="font-mono">{main.max}</span>
                </>
              )}
            </span>
            <span>
              最高閃躲 <span className="font-mono">{main.dodge}</span> · {main.monster.name} Lv
              {main.monster.level}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          算不出命中需求（招式必中或怪物沒有閃躲資料）
        </p>
      )}
      {hit.elites.map((r) => (
        <p
          key={r.monster.npcId}
          className="border-t border-dashed border-border/60 pt-1.5 text-xs text-muted-foreground"
        >
          <b className="font-semibold text-chart-4">菁英</b> {r.monster.name} Lv{r.monster.level} ·
          閃躲 <span className="font-mono text-foreground">{r.dodge}</span> → 需{" "}
          <span className="font-mono text-foreground">{rangeText(r)}</span>
        </p>
      ))}
    </section>
  );
}

interface TrainingSpotCardProps {
  spot: TrainingSpotView;
  drops: TrainingDrop[];
  hit: SpotHit;
  school: string;
}

export function TrainingSpotCard({ spot, drops, hit, school }: TrainingSpotCardProps) {
  const eliteCount = spot.suitableMonsters.filter((m) => m.elite).length + spot.otherElites.length;
  const topNpcId = hit.main?.monster.npcId;

  return (
    // subgrid：同排卡片的標題、命中、怪物、掉落、連結五個區塊各自對齊同一條水平線。
    <Card className="row-span-5 grid grid-rows-subgrid gap-0 py-0">
      <div>
        <div className="flex flex-col gap-1 px-3.5 pt-3.5 pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-lg leading-tight font-bold">{spot.stageName}</h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {eliteCount > 0 && (
                <Badge variant="outline" className="border-chart-4/60 bg-chart-4/10 text-chart-4">
                  <CrownIcon aria-hidden />
                  菁英 {eliteCount}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 font-mono text-primary"
              >
                {levelRange(spot.suitableLevelMin, spot.suitableLevelMax)}
              </Badge>
            </div>
          </div>
          <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {spot.suitableMonsterCount} 種怪 · {spot.suitableSpawnPoints} 個刷怪點
            </span>
            <span>整張圖 {levelRange(spot.monsterLevelMin, spot.monsterLevelMax)}</span>
            {spot.variants.length > 0 && (
              <span className="text-chart-2">
                含分流 {spot.variants.map((v) => v.stageName).join("、")}
              </span>
            )}
          </p>
        </div>

        {spot.onlyElite && (
          <p className="flex items-start gap-2 border-t border-border/60 bg-chart-4/10 px-3.5 py-2 text-xs">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-chart-4" aria-hidden />
            只有菁英怪 {spot.suitableMonsters.map((m) => `${m.name} Lv${m.level}`).join("、")}{" "}
            在你的等級範圍內，這張圖其他怪從 Lv {spot.monsterLevelMin} 起跳，不適合長時間練功。
          </p>
        )}
      </div>

      <HitBlock hit={hit} school={school} onlyElite={spot.onlyElite} />

      <section className="border-t border-border/60 px-3.5 py-3">
        <h4 className="mb-1.5 flex justify-between gap-2 text-xs font-normal text-muted-foreground">
          <span>適配怪物</span>
          <span>數字為閃躲</span>
        </h4>
        <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {spot.suitableMonsters.map((m) => (
            <MonsterCell key={m.npcId} monster={m} isTop={m.npcId === topNpcId} />
          ))}
        </ul>
        {spot.otherElites.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            範圍外的菁英：
            {spot.otherElites.map((m) => (
              <Link
                key={m.npcId}
                href={`/monsters/${m.npcId}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-chart-4/60 bg-chart-4/10 py-0.5 pr-2 pl-0.5 text-foreground transition-colors hover:bg-chart-4/20"
              >
                <EntityPortrait
                  image={m.image}
                  alt=""
                  size="sm"
                  className="size-6 border-0 bg-transparent"
                />
                {m.name}
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  Lv{m.level} · HP {formatRatio(m.hpRatio)}×
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border/60 px-3.5 py-3">
        <h4 className="mb-1.5 flex justify-between gap-2 text-xs font-normal text-muted-foreground">
          <span>掉落物</span>
          <span>掉率為單隻每次擊殺</span>
        </h4>
        <TrainingDropList drops={drops} />
      </section>

      <div>
        <Link
          href={`/maps/${spot.stageId}`}
          className="flex items-center justify-between gap-2 border-t border-border/60 px-3.5 py-3 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          查看{spot.stageName}的地圖與刷怪位置
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
