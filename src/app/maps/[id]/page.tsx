import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRightIcon } from "lucide-react";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { StageFlagBadge } from "@/components/maps/stage-flag-badge";
import { sortStageFlags } from "@/lib/constants/stage-flags";
import { getStageDetail } from "@/lib/queries/stages";
import { getMonstersAtStage } from "@/lib/queries/monster-spawns";
import { getNpcImageMap } from "@/lib/queries/images";
import {
  buildMonsterMarkers,
  getMonsterSpawnPositions,
  getNpcPlacementsForStage,
  getStageMapImage,
} from "@/lib/queries/maps";
import { StageMapViewer } from "@/components/maps/stage-map-viewer";
import type { InboundLink, StageDetail, StageMissionRef } from "@/lib/types/stage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const stageId = Number(id);
  if (!Number.isInteger(stageId) || stageId <= 0) return { title: "地圖 · 玄武" };
  const stage = getStageDetail(stageId);
  if (!stage) return { title: "地圖不存在 · 玄武" };
  return {
    title: `${stage.name ?? `地圖 ${stage.id}`} · 武林同萌傳地圖 · 玄武`,
    description: `${stage.name} 的屬性、入口、相關任務`,
    alternates: { canonical: `/maps/${stage.id}` },
  };
}

const VIA_LABEL: Record<InboundLink["via"][number], string> = {
  appear_map1: "預設入口 1",
  appear_map2: "預設入口 2",
  logout_map: "登出點",
};

function AsideCard({
  title,
  count,
  children,
  flush,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  /** 內容是整列清單時不留內距，讓列 hover 貼齊卡片邊。 */
  flush?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <h2 className="px-4 pt-4 pb-2 font-sans text-sm font-medium">
        {title}
        {count != null && (
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{count}</span>
        )}
      </h2>
      <div className={flush ? "border-t border-border/60" : "px-4 pb-4"}>{children}</div>
    </section>
  );
}

function MapLink({ id, name }: { id: number; name: string | null }) {
  return (
    <Link
      href={`/maps/${id}`}
      className="font-medium underline decoration-dotted underline-offset-4 hover:decoration-solid"
    >
      {name ?? `#${id}`}
    </Link>
  );
}

function Tag({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) return null;
  return <span className="ml-2 text-xs text-muted-foreground tabular-nums">tag {value}</span>;
}

function entranceRows(stage: StageDetail) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [];
  if (stage.appear_map1)
    rows.push({
      label: "預設入口 1",
      value: (
        <>
          <MapLink id={stage.appear_map1} name={stage.appearMap1Name} />
          <Tag value={stage.appear_tag1} />
        </>
      ),
    });
  if (stage.appear_map2)
    rows.push({
      label: "預設入口 2",
      value: (
        <>
          <MapLink id={stage.appear_map2} name={stage.appearMap2Name} />
          <Tag value={stage.appear_tag2} />
        </>
      ),
    });
  if (stage.logout_map)
    rows.push({
      label: "登出回到",
      value: <MapLink id={stage.logout_map} name={stage.logoutMapName} />,
    });
  if (stage.safe_tag != null && stage.safe_tag !== 0)
    rows.push({
      label: "復活點 tag",
      value: <span className="tabular-nums">{stage.safe_tag}</span>,
    });
  if (stage.cave_tag != null && stage.cave_tag !== 0)
    rows.push({ label: "洞穴 tag", value: <span className="tabular-nums">{stage.cave_tag}</span> });
  return rows;
}

function Entrances({ rows }: { rows: ReturnType<typeof entranceRows> }) {
  return (
    <AsideCard title="出入口">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </AsideCard>
  );
}

const rowLink =
  "flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none";

function InboundList({ inbound }: { inbound: InboundLink[] }) {
  return (
    <AsideCard title="指向此處的地圖" count={inbound.length} flush>
      <ul className="divide-y divide-border/60">
        {inbound.map((l) => (
          <li key={l.fromId}>
            <Link href={`/maps/${l.fromId}`} className={rowLink}>
              <span className="min-w-0 flex-1 truncate">{l.fromName}</span>
              <span className="text-xs text-muted-foreground">
                {l.via.map((v) => VIA_LABEL[v]).join("、")}
              </span>
              <ChevronRightIcon className="size-3.5 text-muted-foreground/70" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AsideCard>
  );
}

function MissionsList({ missions }: { missions: StageMissionRef[] }) {
  return (
    <AsideCard title="相關任務" count={missions.length} flush>
      <ul className="divide-y divide-border/60">
        {missions.map((m) => (
          <li key={m.missionId}>
            <Link href={`/missions/${m.missionId}`} className={rowLink}>
              <span className="min-w-0 flex-1 truncate">
                {m.missionName ?? `任務 ${m.missionId}`}
              </span>
              {m.groupId != null && (
                <span className="text-xs text-muted-foreground tabular-nums">分組 {m.groupId}</span>
              )}
              <ChevronRightIcon className="size-3.5 text-muted-foreground/70" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AsideCard>
  );
}

export default async function MapDetailPage({ params }: PageProps) {
  const { id } = await params;
  const stageId = Number(id);
  if (!Number.isInteger(stageId) || stageId <= 0) notFound();

  const stage = getStageDetail(stageId);
  if (!stage || !stage.name) notFound();

  const monsters = getMonstersAtStage(stage.kind, stage.id);
  const mapImage = getStageMapImage(stage.kind, stage.id);
  const npcPlacements = getNpcPlacementsForStage(stage.kind, stage.id);
  const monsterImages = getNpcImageMap(monsters.map((m) => m.npcId));
  // 沒有地圖圖片就不必查座標；markers 仍要建，清單的高血量標示也靠它。
  const monsterMarkers = buildMonsterMarkers(
    monsters,
    mapImage ? getMonsterSpawnPositions(stage.kind, stage.id) : [],
    mapImage,
  ).map((m) => ({ ...m, image: monsterImages.get(m.npcId) ?? null }));

  const npcCount = new Set(npcPlacements.map((p) => p.npcId)).size;
  const levels = monsters.map((m) => m.level).filter((l) => l > 0);
  const stats = [
    monsters.length > 0 && { label: "怪物", value: `${monsters.length} 種` },
    levels.length > 0 && {
      label: "等級",
      value:
        Math.min(...levels) === Math.max(...levels)
          ? `${levels[0]}`
          : `${Math.min(...levels)}–${Math.max(...levels)}`,
    },
    npcCount > 0 && { label: "NPC", value: `${npcCount} 位` },
  ].filter((s): s is { label: string; value: string } => Boolean(s));

  const entrances = entranceRows(stage);
  // 只放有內容的卡片；全空時不留右欄，清單吃滿寬。
  const aside = [
    entrances.length > 0 && <Entrances key="entrances" rows={entrances} />,
    stage.groupSiblings.length > 0 && (
      <AsideCard key="siblings" title="同區域地圖">
        <div className="flex flex-wrap gap-1.5">
          {stage.groupSiblings.map((s) => (
            <Link
              key={s.id}
              href={`/maps/${s.id}`}
              className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </AsideCard>
    ),
    stage.inbound.length > 0 && <InboundList key="inbound" inbound={stage.inbound} />,
    stage.missions.length > 0 && <MissionsList key="missions" missions={stage.missions} />,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/maps">返回地圖列表</BackLink>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-2">
          <h1 className="flex flex-wrap items-baseline gap-x-2.5 text-2xl font-semibold md:text-3xl">
            {stage.name}
            <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">
              #{stage.id}
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {stage.kind === "sestage" && (
              <Badge variant="outline" className="font-normal">
                SE 地圖
              </Badge>
            )}
            {stage.group != null && (
              <Badge variant="outline" className="rounded-md font-normal text-muted-foreground">
                區域 #{stage.group}
              </Badge>
            )}
            {sortStageFlags(stage.flags).map((f) => (
              <StageFlagBadge key={f} flag={f} />
            ))}
          </div>
        </div>
        {stats.length > 0 && (
          <dl className="flex gap-6 text-sm">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      <StageMapViewer
        key={`${stage.kind}:${stage.id}`}
        stageName={stage.name}
        image={mapImage}
        placements={npcPlacements}
        monsters={monsterMarkers}
        aside={aside.length > 0 ? aside : null}
      />
    </div>
  );
}
