import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { Badge } from "@/components/ui/badge";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { MissionStepText } from "@/components/missions/mission-step-text";
import { MissionDialogueSection } from "@/components/missions/mission-dialogue";
import { NpcList } from "@/components/missions/npc-portrait";
import { getMissionDetail } from "@/lib/queries/missions";
import { getItemIconMap, getNpcImageMap, type EntityImage } from "@/lib/queries/images";
import { ItemIcon } from "@/components/common/item-icon";
import { GameText } from "@/components/common/game-text";
import {
  buildFlowRows,
  MissionAcceptSection,
  MissionRequirementSection,
  MissionRewardSection,
} from "@/components/missions/mission-logic";
import { getMissionLogic } from "@/lib/queries/mission-logic";
import type { MissionItemRef, MissionMapRef } from "@/lib/types/mission";
import type { MissionFlowStep } from "@/lib/types/mission-logic";
import { CircleCheckIcon, MessageSquareIcon } from "lucide-react";

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
    title: `${mission.name ?? `任務 ${mission.id}`} · 武林同萌傳任務 · 玄武`,
    description: (mission.help ?? `${mission.name} 的步驟與所需物品`).replace(/\\n/g, " "),
    alternates: { canonical: `/missions/${mission.id}` },
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

function MapChips({
  maps,
  npcImageMap,
}: {
  maps: MissionMapRef[];
  npcImageMap: Map<number, EntityImage>;
}) {
  const groups = groupMaps(maps);
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((g, i) => {
        const label = g.label || (g.npcName ?? `NPC #${g.npcId}`);
        const coord =
          g.x != null && g.y != null && (g.x !== 0 || g.y !== 0)
            ? `(${g.x},${g.y})`
            : null;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {g.npcId > 0 && (
              <EntityPortrait
                image={npcImageMap.get(g.npcId) ?? null}
                alt={label}
                size="sm"
              />
            )}
            <Badge variant="outline" className="font-normal">
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
          </span>
        );
      })}
    </div>
  );
}

function ItemSummary({
  items,
  itemIconMap,
}: {
  items: MissionItemRef[];
  itemIconMap: Map<number, EntityImage>;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
      {items.map((it) => (
        <li key={it.itemId} className="flex items-baseline gap-2 px-3 py-2">
          <ItemIcon
            image={itemIconMap.get(it.itemId) ?? null}
            alt={it.name}
            className="size-6"
          />
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

function FlowDialogue({
  flow,
  divided,
  npcImages,
  hideText = false,
}: {
  flow: MissionFlowStep;
  divided: boolean;
  npcImages: Record<string, EntityImage | null>;
  /** 任務完成那句常與最後一步是同一段對話，重複時只留 NPC 名。 */
  hideText?: boolean;
}) {
  return (
    <div
      className={
        divided
          ? "space-y-1 border-t border-border/60 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4"
          : "space-y-1"
      }
    >
      {flow.npcs.length > 0 ? (
        <div className="text-xs font-medium">
          <NpcList names={flow.npcs} images={npcImages} portraitClassName="size-7" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquareIcon className="size-3.5" aria-hidden />
          <span>系統</span>
        </div>
      )}
      {hideText ? null : flow.dialogue ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          「<GameText text={flow.dialogue} maxChars={60} />」
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">（無台詞）</p>
      )}
    </div>
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

  // 任務全程引用到的 NPC 立繪（npcId=0 為地標/怪物名，非具體 NPC，略過）
  const npcIds = mission.allMaps
    .filter((m) => m.npcId > 0)
    .map((m) => m.npcId);
  const npcImageMap = getNpcImageMap(npcIds);
  const itemIconMap = getItemIconMap(mission.allItems.map((it) => it.itemId));

  const logic = getMissionLogic(mission.id);
  const hasLogic =
    logic.acceptNpcs.length > 0 ||
    logic.completeNpcs.length > 0 ||
    logic.timers.length > 0 ||
    logic.requirementGroups.length > 0 ||
    logic.rewards.length > 0 ||
    logic.deliveries.length > 0;
  const flowRows = buildFlowRows(mission.steps, logic.flow);

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
            <MapChips maps={mission.helpMaps} npcImageMap={npcImageMap} />
          )}
        </section>
      )}

      {hasLogic ? (
        <>
          <MissionAcceptSection logic={logic} />
          <MissionRequirementSection groups={logic.requirementGroups} />
          <MissionRewardSection logic={logic} />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          客戶端資料未記載此任務的接取 NPC、接取條件與獎勵。
        </p>
      )}

      {mission.allItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">所需物品</h2>
          <ItemSummary items={mission.allItems} itemIconMap={itemIconMap} />
          <p className="text-xs text-muted-foreground">
            數量為步驟中出現的最大需求量；同物品多步出現時取最大值。
          </p>
        </section>
      )}

      {flowRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">任務流程</h2>
          <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-border">
            {flowRows.map((row, i) => (
              <li key={row.key} className="relative pl-6">
                <span
                  aria-hidden
                  className={
                    row.kind === "complete"
                      ? "absolute top-[1.3rem] left-0 size-[11px] rounded-full bg-primary"
                      : "absolute top-[1.3rem] left-0 size-[11px] rounded-full border-2 border-primary/70 bg-background"
                  }
                />
                <div className="space-y-2 rounded-lg border border-border/60 bg-card p-4">
                  <div className="flex items-baseline gap-2">
                    {row.kind === "complete" ? (
                      <Badge variant="secondary">
                        <CircleCheckIcon aria-hidden />
                        任務完成
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-mono">
                        Step {row.index}
                      </Badge>
                    )}
                    {row.kind === "accept" && (
                      <Badge variant="outline" className="font-normal">
                        接取
                      </Badge>
                    )}
                  </div>
                  <div
                    className={
                      row.step && row.flow
                        ? "grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] md:gap-4"
                        : undefined
                    }
                  >
                    {row.step && (
                      <div className="space-y-2">
                        <p className="text-sm leading-relaxed">
                          <MissionStepText rawText={row.step.rawText} itemsLookup={itemsLookup} />
                        </p>
                        {row.step.maps.length > 0 && (
                          <MapChips maps={row.step.maps} npcImageMap={npcImageMap} />
                        )}
                      </div>
                    )}
                    {row.flow && (
                      <FlowDialogue
                        flow={row.flow}
                        divided={row.step != null}
                        npcImages={logic.npcImages}
                        hideText={
                          row.kind === "complete" &&
                          row.flow.dialogue != null &&
                          row.flow.dialogue === flowRows[i - 1]?.flow?.dialogue
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {logic.flow.length > 0 && (
            <p className="text-xs text-muted-foreground">
              每步附的對話是完成該步時觸發的 NPC 台詞節錄（Step 1 為接取時的台詞）；對話與步驟是依序號推算對齊，少數任務可能差一步。
            </p>
          )}
        </section>
      )}

      <MissionDialogueSection missionId={mission.id} />

      <p className="text-xs text-muted-foreground">
        資料來自 MISSION.INI；步驟文字保留原始的內嵌標籤語意（地點、目標 NPC、物品名與數量）。
      </p>
    </div>
  );
}
