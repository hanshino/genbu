import Link from "next/link";
import { Fragment } from "react";
import { LinkListRow } from "@/components/common/link-list";
import { linkClass, rewardView, TimedBadge } from "@/components/common/reward-view";
import { ItemSubSection } from "@/components/items/item-section-group";
import { ShowMoreList } from "@/components/items/mystery-table";
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

function GrantList({ rewards, use = false, map = false }: { rewards: DialogueGrant[]; use?: boolean; map?: boolean }) {
  return (
    <ShowMoreList>
      {rewards.map((r) => (
        <LinkListRow key={r.grantId}>
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
      ))}
    </ShowMoreList>
  );
}

function NpcGroups({ groups, use = false }: { groups: NpcDialogueSource[]; use?: boolean }) {
  return (
    <ShowMoreList>
      {groups.map((g, i) => (
        <LinkListRow key={i}>
          {g.npcId == null ? (
            <span className="font-medium">{g.orphan ? "其他對話（入口未明）" : g.npcName || "未收錄 NPC"}</span>
          ) : (
            <Link href={`/npcs/${g.npcId}`} className={linkClass}>{g.npcName}</Link>
          )}
          <div className="basis-full"><GrantList rewards={g.rewards} use={use} /></div>
        </LinkListRow>
      ))}
    </ShowMoreList>
  );
}

export function NpcDialogueSourcesSection({ rewards }: { rewards: NpcDialogueSource[] }) {
  if (rewards.length === 0) return null;
  const count = rewards.filter((r) => !r.orphan).length;
  return (
    <ItemSubSection title="NPC 對話" summary={`${count} 位 NPC${rewards.some((r) => r.orphan) ? "／其他對話" : ""}對話中給予`}>
      <NpcGroups groups={rewards} />
    </ItemSubSection>
  );
}

export function NpcDialogueUsesSection({ takes }: { takes: NpcDialogueSource[] }) {
  if (takes.length === 0) return null;
  return (
    <ItemSubSection title="NPC 對話與兌換用途" summary={`${takes.length} 組兌換來源`}>
      <NpcGroups groups={takes} use />
    </ItemSubSection>
  );
}

export function MapEventSourcesSection({ sources }: { sources: MapDialogueSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ItemSubSection title="地圖事件" summary={`${sources.length} 張地圖`} footer="事件可能另有條件限制，實際觸發方式以遊戲內為準。">
      <ShowMoreList>
        {sources.map((s) => (
          <LinkListRow key={`${s.stageKind}:${s.stageId}`}>
            <span className="font-mono text-xs text-muted-foreground">#{s.stageId}</span>
            <Link href={`/maps/${s.stageId}`} className={linkClass}>{s.stageName ?? `地圖 ${s.stageId}`}</Link>
            <div className="basis-full"><GrantList rewards={s.rewards} map /></div>
          </LinkListRow>
        ))}
      </ShowMoreList>
    </ItemSubSection>
  );
}
