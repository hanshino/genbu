import Link from "next/link";
import { Fragment } from "react";
import { LinkListRow } from "@/components/common/link-list";
import { linkClass, rewardView, TimedBadge } from "@/components/common/reward-view";
import { ItemSubSection } from "@/components/items/item-section-group";
import { ShowMoreList } from "@/components/common/capped-list";
import type { DialogueGrant, DialogueItem, MapDialogueSource, NpcDialogueSource } from "@/lib/types/dialogue-rewards";

function ItemAmount({ item }: { item: DialogueItem }) {
  const view = rewardView({
    type: item.durationMin == null ? "item" : "timed_item",
    refId: item.itemId, qty: item.qty, durationMin: item.durationMin,
    resolved: { itemName: item.itemName ?? undefined, itemIcon: item.icon },
  });
  return (
    <span className="inline-flex items-center gap-1">
      {view.lead}{view.label}{view.extra}
      {view.value && <span className="font-mono">{view.value}</span>}
    </span>
  );
}

function ExchangeCost({ reward }: { reward: DialogueGrant }) {
  if (reward.costItems.length === 0 && reward.costGold == null) return null;
  return (
    <span className="flex basis-full flex-wrap items-center gap-1 text-xs text-muted-foreground">
      以
      {reward.costItems.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && "、"}<ItemAmount item={item} />
        </Fragment>
      ))}
      {reward.costGold != null && (
        <span>{reward.costItems.length > 0 && "、"}{reward.costGold.toLocaleString("zh-TW")} 銀兩</span>
      )}
      兌換
    </span>
  );
}

function grantName(g: NpcDialogueSource): string {
  return g.orphan ? "其他對話（入口未明）" : g.npcName || "未收錄 NPC";
}

function NpcLabel({ group }: { group: NpcDialogueSource }) {
  return group.npcId == null ? (
    <span className="font-medium">{grantName(group)}</span>
  ) : (
    <Link href={`/npcs/${group.npcId}`} className={linkClass}>{group.npcName}</Link>
  );
}

/** 單筆給予／兌換的內容；npc 有給時在列首標出是哪位 NPC（多位 NPC 攤平成一張清單時用）。 */
function GrantRow({ reward: r, npc, use = false, map = false }: {
  reward: DialogueGrant; npc?: NpcDialogueSource; use?: boolean; map?: boolean;
}) {
  return (
    <LinkListRow>
      {npc && <NpcLabel group={npc} />}
      {map && r.triggers.map((t, i) => (
        <span key={i} className="text-xs text-muted-foreground">
          {t.bind === "death" ? "怪物死亡觸發" : t.bind === "zone" ? "走上區域觸發" : "觸發方式未明"}
          {t.monsterName && `：${t.monsterName}`}
        </span>
      ))}
      {r.durationMin != null && <TimedBadge durationMin={r.durationMin} />}
      {r.qty != null && (
        <span className="ml-auto font-mono text-xs text-muted-foreground">{use && "收走 "}×{r.qty}</span>
      )}
      <ExchangeCost reward={r} />
      {use && (
        <span className="flex basis-full flex-wrap items-center gap-1 text-xs text-muted-foreground">
          可換得
          {r.returns.map((item, i) => (
            <Fragment key={i}>{i > 0 && "、"}<ItemAmount item={item} /></Fragment>
          ))}
        </span>
      )}
    </LinkListRow>
  );
}

/**
 * NPC 給予／兌換攤平成一張清單、一顆「顯示全部」：上限算的是總筆數，不是 NPC 位數。
 * 只有一位 NPC 時名字已在標題列，列首就不再重複。
 */
function NpcGrantList({ groups, limit, use = false }: { groups: NpcDialogueSource[]; limit: number; use?: boolean }) {
  const multi = groups.length > 1;
  return (
    <ShowMoreList limit={limit} unit="筆">
      {groups.flatMap((g, gi) =>
        g.rewards.map((r) => (
          <GrantRow key={`${gi}:${r.grantId}`} reward={r} npc={multi ? g : undefined} use={use} />
        )),
      )}
    </ShowMoreList>
  );
}

function npcHighlight(groups: NpcDialogueSource[]): string {
  const first = grantName(groups[0]);
  return groups.length > 1 ? `${first} 等` : first;
}

export function NpcDialogueSourcesSection({ rewards }: { rewards: NpcDialogueSource[] }) {
  if (rewards.length === 0) return null;
  return (
    <ItemSubSection title="NPC 對話" count={`${rewards.length} 位`} highlight={npcHighlight(rewards)}>
      {rewards.length === 1 && rewards[0].npcId != null && (
        <p className="text-xs text-muted-foreground">
          <NpcLabel group={rewards[0]} /> 對話中給予
        </p>
      )}
      <NpcGrantList groups={rewards} limit={10} />
    </ItemSubSection>
  );
}

export function NpcDialogueUsesSection({ takes }: { takes: NpcDialogueSource[] }) {
  if (takes.length === 0) return null;
  const total = takes.reduce((n, g) => n + g.rewards.length, 0);
  const firstReturn = takes[0].rewards[0]?.returns[0];
  const returnName = firstReturn && (firstReturn.itemName ?? `道具 #${firstReturn.itemId}`);
  return (
    <ItemSubSection
      title="NPC 對話與兌換用途"
      count={`${total} 筆`}
      highlight={returnName ? `可換 ${returnName}${total > 1 ? " 等" : ""}` : npcHighlight(takes)}
    >
      {takes.length === 1 && takes[0].npcId != null && (
        <p className="text-xs text-muted-foreground">
          向 <NpcLabel group={takes[0]} /> 兌換
        </p>
      )}
      <NpcGrantList groups={takes} limit={8} use />
    </ItemSubSection>
  );
}

export function MapEventSourcesSection({ sources }: { sources: MapDialogueSource[] }) {
  if (sources.length === 0) return null;
  const first = sources[0];
  return (
    <ItemSubSection
      title="地圖事件"
      count={`${sources.length} 張地圖`}
      highlight={first.stageName ?? `地圖 ${first.stageId}`}
      note="事件可能另有條件限制，實際觸發方式以遊戲內為準。"
    >
      <ShowMoreList unit="張地圖">
        {sources.map((s) => (
          <LinkListRow key={`${s.stageKind}:${s.stageId}`}>
            <span className="font-mono text-xs text-muted-foreground">#{s.stageId}</span>
            <Link href={`/maps/${s.stageId}`} className={linkClass}>{s.stageName ?? `地圖 ${s.stageId}`}</Link>
            {/* 同一張地圖的觸發通常只有一兩筆，不另設上限，避免清單裡再套一顆「顯示全部」 */}
            <ul className="basis-full divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
              {s.rewards.map((r) => <GrantRow key={r.grantId} reward={r} map />)}
            </ul>
          </LinkListRow>
        ))}
      </ShowMoreList>
    </ItemSubSection>
  );
}
