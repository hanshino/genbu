import Link from "next/link";
import { ArrowRightIcon, LayersIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EntityPortrait } from "@/components/common/entity-portrait";
import type { TrainingSpot, TrainingSpotMonster } from "@/lib/types/monster-spawn";

/** 卡片立繪帶最多顯示的怪物數；其餘以 +N 表示。 */
const PREVIEW_LIMIT = 5;

function levelRange(min: number, max: number) {
  return min === max ? `Lv ${min}` : `Lv ${min} – ${max}`;
}

/**
 * 立繪格：統一 56×64 容器 + object-contain（原圖 48×65 到 177×187 都有，不可變形）。
 * 有立繪時去掉外框、加地面光暈與投影；無立繪時保留虛線框，走 EntityPortrait 的 ghost fallback。
 */
function MonsterCell({ monster }: { monster: TrainingSpotMonster }) {
  const hasImage = monster.image !== null;
  return (
    <li className="flex w-14 shrink-0 flex-col items-center gap-1">
      <div
        className={
          hasImage
            ? "relative grid place-items-center rounded-md bg-gradient-to-b from-transparent via-transparent to-primary/10 after:absolute after:inset-x-2 after:bottom-1 after:-z-0 after:h-1.5 after:rounded-[50%] after:bg-foreground/20 after:blur-[3px]"
            : "grid place-items-center"
        }
      >
        <EntityPortrait
          image={monster.image}
          alt={monster.name}
          size="md"
          className={
            hasImage
              ? "relative z-10 border-0 bg-transparent [&_img]:drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]"
              : "border-dashed bg-muted/50"
          }
        />
      </div>
      <Badge
        variant="outline"
        className="h-4 rounded-md border-primary/30 bg-primary/10 px-1.5 font-mono text-[0.65rem] text-primary"
      >
        {monster.level}
      </Badge>
      <span className="line-clamp-2 min-h-[2.2em] text-center text-[0.63rem] leading-[1.1] text-muted-foreground">
        {monster.name}
      </span>
    </li>
  );
}

export function TrainingSpotCard({ spot }: { spot: TrainingSpot }) {
  const preview = spot.suitableMonsters.slice(0, PREVIEW_LIMIT);
  const overflow = spot.suitableMonsterCount - preview.length;
  const missingArt = preview.filter((m) => m.image === null).length;

  const stripCaption = [
    `${spot.suitableMonsterCount} 種適配怪物`,
    overflow > 0 ? `顯示前 ${preview.length} 種` : null,
    missingArt > 0 ? `其中 ${missingArt} 種資料庫無立繪` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-1 px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-lg leading-tight font-bold">{spot.stageName}</h3>
          {spot.stageKind === "sestage" && (
            <Badge variant="outline" className="shrink-0 font-normal">
              <LayersIcon aria-hidden />
              SE 地圖
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem] text-muted-foreground">
          <code className="font-mono">
            {spot.stageKind}:{spot.stageId}
          </code>
          {spot.groupId != null && (
            <>
              <span aria-hidden className="opacity-40">
                ·
              </span>
              <span>區域 {spot.groupId}</span>
            </>
          )}
        </div>
      </div>

      {/* 立繪帶：卡片主視覺 */}
      <div className="border-y border-border/60 bg-gradient-to-b from-muted/20 to-muted/60 px-3.5 pt-2.5 pb-3">
        <ul className="flex flex-wrap gap-2">
          {preview.map((m) => (
            <MonsterCell key={m.npcId} monster={m} />
          ))}
        </ul>
        {/* +N 放在說明行而非立繪帶尾端：375 寬時第 6 格必然換行，會多吃一整列高度 */}
        <div className="mt-2 flex items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
          <span>{stripCaption}</span>
          {overflow > 0 && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 rounded-md border-dashed px-1.5 font-mono text-[0.65rem] font-normal text-muted-foreground"
            >
              +{overflow} 種
            </Badge>
          )}
        </div>
      </div>

      <dl className="flex items-end gap-4 px-3.5 pt-3">
        <div className="flex flex-col">
          <dt className="text-[0.7rem] text-muted-foreground">適配刷怪點</dt>
          <dd className="font-mono text-2xl leading-none font-bold tracking-tight">
            {spot.suitableSpawnPoints}
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              / {spot.spawnPoints}
            </span>
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[0.7rem] text-muted-foreground">怪物種類</dt>
          <dd className="font-mono text-base leading-none font-bold">
            {spot.suitableMonsterCount}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">
              / {spot.monsterCount}
            </span>
          </dd>
        </div>
        <div className="ml-auto pb-0.5 text-right font-mono text-[0.7rem] whitespace-nowrap text-muted-foreground">
          全部怪物{" "}
          <b className="font-medium text-foreground">
            {levelRange(spot.monsterLevelMin, spot.monsterLevelMax)}
          </b>
        </div>
      </dl>

      {/* 集中度壓成單行，但分子分母必須同行可見 */}
      <p className="mx-3.5 mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5">
        <span className="text-[0.7rem] text-muted-foreground">等級集中度</span>
        <span className="font-mono text-sm font-bold text-primary">
          {Math.round(spot.fitPercent)}%
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          適配刷怪點 <b className="font-medium text-foreground">{spot.suitableSpawnPoints}</b> ÷
          有效刷怪點 <b className="font-medium text-foreground">{spot.spawnPoints}</b>
        </span>
      </p>

      {spot.unknownLevelSpawnPoints > 0 && (
        <p className="mx-3.5 mt-2.5 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          另有 {spot.unknownLevelSpawnPoints} 個刷怪點的怪物等級未知，未計入。
        </p>
      )}

      {/* mt-auto：兩欄時同列卡片高度不同，把 link 壓到底部對齊 */}
      <div className="mt-auto pt-3.5">
        <Link
          href={`/maps/${spot.stageId}`}
          className="flex items-center justify-between gap-2 border-t border-border/60 px-3.5 py-3 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          查看{spot.stageName}的地圖與怪物
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
