import { ChevronDownIcon } from "lucide-react";
import { LinkListRow } from "@/components/common/link-list";
import { ItemIcon } from "@/components/common/item-icon";
import { RewardLine, TimedBadge } from "@/components/common/reward-view";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ItemLinkList, ItemSubSection } from "@/components/items/item-section-group";
import type {
  BoxContainingItem,
  BoxRewardNode,
  ItemBoxOption,
  MissionRewardingItem,
} from "@/lib/types/mission-logic";

// =========================================================================
// 使用後可獲得（開箱內容，巢狀禮盒可展開）
// =========================================================================

const rowClass = "flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm";

function optionLabel(o: ItemBoxOption, i: number) {
  return o.choicePath ?? `情況 ${i + 1}`;
}

function RewardRow({ reward, caption }: { reward: BoxRewardNode; caption?: string }) {
  const captionEl = caption && (
    <span className="basis-full truncate pl-8 text-xs text-muted-foreground">{caption}</span>
  );
  if (!reward.contents || reward.contents.length === 0) {
    return (
      <li className={rowClass}>
        <RewardLine reward={reward} />
        {captionEl}
      </li>
    );
  }
  return (
    <li>
      <Collapsible>
        <div className={rowClass}>
          <RewardLine
            reward={reward}
            trailing={
              <CollapsibleTrigger className="group inline-flex w-auto items-center gap-0.5 rounded-md border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                內容
                <ChevronDownIcon
                  className="size-3.5 transition-transform group-data-[panel-open]:rotate-180"
                  aria-hidden
                />
              </CollapsibleTrigger>
            }
          />
          {captionEl}
        </div>
        <CollapsiblePanel>
          <div className="border-t border-dashed border-border/60 bg-muted/20 py-2 pr-2 pl-8">
            <BoxOptions options={reward.contents} />
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </li>
  );
}

function RewardList({ rewards }: { rewards: BoxRewardNode[] }) {
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
      {rewards.map((r, i) => (
        <RewardRow key={i} reward={r} />
      ))}
    </ul>
  );
}

function BoxOptions({ options }: { options: ItemBoxOption[] }) {
  if (options.length === 1) return <RewardList rewards={options[0].rewards} />;

  // 每個選項只有一樣東西（如兵器兌換券）：攤平成兩欄清單，選項名當小字說明，省掉卡片標頭。
  if (options.every((o) => o.rewards.length === 1)) {
    return (
      <ul className="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-2 [&>li]:bg-card sm:[&>li:last-child:nth-child(odd)]:col-span-2">
        {options.map((o, i) => (
          <RewardRow key={i} reward={o.rewards[0]} caption={optionLabel(o, i)} />
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5 text-xs">
            <span className="font-mono text-muted-foreground">{i + 1}</span>
            <span className="font-medium">{optionLabel(o, i)}</span>
          </div>
          <ul className="divide-y divide-border/60">
            {o.rewards.map((r, j) => (
              <RewardRow key={j} reward={r} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function BoxContentsSection({ options }: { options: ItemBoxOption[] }) {
  if (options.length === 0) return null;
  const multi = options.length > 1;
  const hasChoice = options.some((o) => o.choicePath != null);
  return (
    <ItemSubSection
      title="使用後可獲得"
      summary={multi ? `擇一 · 共 ${options.length} 種` : `${options[0].rewards.length} 項`}
      footer={
        multi
          ? hasChoice
            ? "開啟時依選單選擇其中一項，只會拿到該選項的內容。"
            : "依條件不同只會得到其中一種結果；「情況」編號僅供區分。"
          : undefined
      }
    >
      <BoxOptions options={options} />
    </ItemSubSection>
  );
}

// =========================================================================
// 可從這些禮盒取得
// =========================================================================

interface BoxGroup {
  box: BoxContainingItem;
  choicePaths: string[];
  qtys: number[];
  durationMin: number | null;
}

function groupBoxes(rows: BoxContainingItem[]): BoxGroup[] {
  const map = new Map<number, BoxGroup>();
  for (const r of rows) {
    let g = map.get(r.boxItemId);
    if (!g) {
      g = { box: r, choicePaths: [], qtys: [], durationMin: r.durationMin };
      map.set(r.boxItemId, g);
    }
    if (r.choicePath && !g.choicePaths.includes(r.choicePath)) g.choicePaths.push(r.choicePath);
    if (r.qty != null && !g.qtys.includes(r.qty)) g.qtys.push(r.qty);
  }
  return [...map.values()];
}

export function BoxSourcesSection({ boxes }: { boxes: BoxContainingItem[] }) {
  if (boxes.length === 0) return null;
  const groups = groupBoxes(boxes);
  return (
    <ItemSubSection title="可從這些禮盒取得" summary={`${groups.length} 種禮盒`}>
      <ItemLinkList>
        {groups.map(({ box, choicePaths, qtys, durationMin }) => {
          const name = box.boxItemName ?? `道具 #${box.boxItemId}`;
          return (
            <LinkListRow key={box.boxItemId} href={`/items/${box.boxItemId}`}>
              <ItemIcon image={box.boxIcon} alt={name} className="size-6 self-center" />
              <span className="font-medium">{name}</span>
              <span className="font-mono text-xs text-muted-foreground">#{box.boxItemId}</span>
              {durationMin != null && <TimedBadge durationMin={durationMin} />}
              {choicePaths.length > 0 && (
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  選項：{choicePaths.join("、")}
                </span>
              )}
              {qtys.length > 0 && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">×{qtys.join(" / ")}</span>
              )}
            </LinkListRow>
          );
        })}
      </ItemLinkList>
    </ItemSubSection>
  );
}

// =========================================================================
// 任務獎勵
// =========================================================================

export function MissionRewardSourcesSection({ missions }: { missions: MissionRewardingItem[] }) {
  if (missions.length === 0) return null;
  const count = new Set(missions.map((m) => m.missionId)).size;
  return (
    <ItemSubSection title="任務獎勵" summary={`${count} 個任務完成後給予`}>
      <ItemLinkList>
        {missions.map((m, i) => (
          <LinkListRow key={`${m.missionId}-${i}`} href={`/missions/${m.missionId}`}>
            <span className="font-mono text-xs text-muted-foreground">#{m.missionId}</span>
            <span className="font-medium">{m.missionName ?? `任務 ${m.missionId}`}</span>
            {m.durationMin != null && <TimedBadge durationMin={m.durationMin} />}
            {m.qty != null && <span className="ml-auto font-mono text-xs text-muted-foreground">×{m.qty}</span>}
          </LinkListRow>
        ))}
      </ItemLinkList>
    </ItemSubSection>
  );
}
