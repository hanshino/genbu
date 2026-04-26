import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { MissionStepText } from "@/components/missions/mission-step-text";
import { MissionDialogueSection } from "@/components/missions/mission-dialogue";
import { getMissionDetail } from "@/lib/queries/missions";
import type { MissionItemRef, MissionMapRef } from "@/lib/types/mission";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const missionId = Number(id);
  if (!Number.isInteger(missionId) || missionId <= 0) return { title: "任務 · 玄武" };
  const mission = getMissionDetail(missionId);
  if (!mission) return { title: "任務不存在 · 玄武" };
  return {
    title: `${mission.name ?? `任務 ${mission.id}`} · 任務 · 玄武`,
    description: mission.help ?? `${mission.name} 的步驟與所需物品`,
  };
}

function groupLabel(groupId: number | null): string {
  return groupId == null ? "未分類" : `分組 #${groupId}`;
}

interface MapBucketEntry {
  mapId: number;
  mapName: string | null;
}

/** 把 mission_refs.maps 依 (npcId, label) 聚合，把多張地圖併在同一張 chip。 */
function groupMaps(maps: MissionMapRef[]) {
  const buckets = new Map<
    string,
    {
      npcId: number;
      label: string;
      npcName: string | null;
      maps: MapBucketEntry[];
      x: number | null;
      y: number | null;
    }
  >();
  for (const m of maps) {
    const key = `${m.npcId}:${m.label ?? ""}`;
    const b = buckets.get(key);
    if (b) {
      if (!b.maps.some((x) => x.mapId === m.mapId)) {
        b.maps.push({ mapId: m.mapId, mapName: m.mapName });
      }
    } else {
      buckets.set(key, {
        npcId: m.npcId,
        label: m.label ?? "",
        npcName: m.npcName,
        maps: [{ mapId: m.mapId, mapName: m.mapName }],
        x: m.x,
        y: m.y,
      });
    }
  }
  return [...buckets.values()];
}

function MapLinks({ maps }: { maps: MapBucketEntry[] }) {
  // 多張地圖時用「、」分隔；單張地圖直接顯示名稱（或 fallback 到 #id）。
  const visible = maps.slice(0, 3);
  const overflow = maps.length - visible.length;
  return (
    <span className="font-mono text-[0.7rem] text-muted-foreground">
      {visible.map((m, idx) => (
        <span key={m.mapId}>
          {idx > 0 && <span className="text-muted-foreground/60">、</span>}
          <Link
            href={`/maps/${m.mapId}`}
            className="underline decoration-dotted underline-offset-2 hover:decoration-solid hover:text-foreground"
          >
            {m.mapName ?? `#${m.mapId}`}
          </Link>
        </span>
      ))}
      {overflow > 0 && <span className="ml-0.5">+{overflow}</span>}
    </span>
  );
}

function MapChips({ maps }: { maps: MissionMapRef[] }) {
  const groups = groupMaps(maps);
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((g, i) => {
        const label = g.label || (g.npcName ?? `NPC #${g.npcId}`);
        const coord =
          g.x != null && g.y != null && (g.x !== 0 || g.y !== 0)
            ? `(${g.x},${g.y})`
            : null;
        return (
          <Badge key={i} variant="outline" className="font-normal">
            <span>{label}</span>
            <span className="ml-1.5 inline-flex items-baseline gap-1">
              <MapLinks maps={g.maps} />
              {coord && (
                <span className="font-mono text-[0.7rem] text-muted-foreground">
                  {coord}
                </span>
              )}
            </span>
          </Badge>
        );
      })}
    </div>
  );
}

function ItemSummary({ items }: { items: MissionItemRef[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
      {items.map((it) => (
        <li key={it.itemId} className="flex items-baseline gap-2 px-3 py-2">
          <Link
            href={`/items/${it.itemId}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {it.name}
          </Link>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {it.qty != null ? `×${it.qty}` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function MissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const missionId = Number(id);
  if (!Number.isInteger(missionId) || missionId <= 0) notFound();

  const mission = getMissionDetail(missionId);
  if (!mission) notFound();

  // 給 step-text 用的 itemId → ref lookup（每步 + help 合併，名稱以最先出現為準）
  const itemsLookup = new Map<number, MissionItemRef>();
  for (const it of mission.allItems) itemsLookup.set(it.itemId, it);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/missions">返回任務列表</BackLink>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">#{mission.id}</span>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {mission.name ?? `任務 ${mission.id}`}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="font-normal">
            {groupLabel(mission.groupId)}
          </Badge>
          {mission.cycleTime != null && (
            <Badge variant="outline" className="font-normal">
              可重複（CycleTime={mission.cycleTime}）
            </Badge>
          )}
          {mission.hidMissionGroup != null && (
            <Badge variant="outline" className="font-normal">
              隱藏分組 #{mission.hidMissionGroup}
            </Badge>
          )}
          {mission.steps.length === 0 && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              已停用
            </Badge>
          )}
        </div>
      </header>

      {mission.help && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">總述</h2>
          <div className="rounded-lg border border-border/60 bg-card p-4 text-sm leading-relaxed">
            <MissionStepText rawText={mission.help} itemsLookup={itemsLookup} />
          </div>
          {(mission.helpItems.length > 0 || mission.helpMaps.length > 0) && (
            <MapChips maps={mission.helpMaps} />
          )}
        </section>
      )}

      {mission.allItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">所需物品</h2>
          <ItemSummary items={mission.allItems} />
          <p className="text-xs text-muted-foreground">
            數量為步驟中出現的最大需求量；同物品多步出現時取最大值。
          </p>
        </section>
      )}

      {mission.steps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">步驟</h2>
          <ol className="space-y-3">
            {mission.steps.map((s) => (
              <li
                key={s.index}
                className="space-y-2 rounded-lg border border-border/60 bg-card p-4"
              >
                <div className="flex items-baseline gap-2">
                  <Badge variant="secondary" className="font-mono">
                    Step {s.index}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed">
                  <MissionStepText rawText={s.rawText} itemsLookup={itemsLookup} />
                </p>
                {s.maps.length > 0 && <MapChips maps={s.maps} />}
              </li>
            ))}
          </ol>
        </section>
      )}

      <MissionDialogueSection missionId={mission.id} />

      <p className="text-xs text-muted-foreground">
        資料來自 MISSION.INI；步驟文字保留原始的內嵌標籤語意（地點、目標 NPC、物品名與數量）。
      </p>
    </div>
  );
}
