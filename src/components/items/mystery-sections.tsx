import Link from "next/link";
import { LockIcon } from "lucide-react";
import { ItemIcon } from "@/components/common/item-icon";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { LinkListRow } from "@/components/common/link-list";
import { linkClass } from "@/components/common/reward-view";
import { ItemSubSection } from "@/components/items/item-section-group";
import { MysteryTable, ShowMoreList, type MysteryTableRow } from "@/components/items/mystery-table";
import type { MysteryBoxContents, MysteryBoxInfo, MysteryEntry, MysterySource } from "@/lib/types/mystery";

// 隨機寶箱（mystery_boxes）：依權重隨機抽，和對話開啟的 item_box_rewards 分開呈現。

const RARE_BELOW = 0.01;

/** 單次抽取機率 → 百分比，保留 3 位有效數字（21%、46.9%、0.001%）。 */
export function formatProb(p: number): string {
  return `${(p * 100).toLocaleString("zh-TW", { maximumSignificantDigits: 3 })}%`;
}

/** 「每次開出 N 樣」；min ≠ max 時「每次開出 2–4 樣」。 */
export function formatDrop(info: Pick<MysteryBoxInfo, "minDrop" | "maxDrop">): string | null {
  const { minDrop: min, maxDrop: max } = info;
  if (min == null && max == null) return null;
  if (min == null || max == null || min === max) return `每次開出 ${min ?? max} 樣`;
  return `每次開出 ${min}–${max} 樣`;
}

const HIDDEN_NOTE = "此寶箱內容由伺服器決定，客戶端資料未公開";

function entryName(e: MysteryEntry): { node: React.ReactNode; text: string; icon: React.ReactNode } {
  if (e.rewardType === "item") {
    const name = e.itemName ?? `道具 #${e.refId}`;
    return {
      icon: <ItemIcon image={e.itemIcon} alt={name} className="size-6" />,
      node: (
        <Link href={`/items/${e.refId}`} className={linkClass}>
          {name}
        </Link>
      ),
      text: name,
    };
  }
  const name = e.heroName ?? `英雄符令 #${e.refId}`;
  return {
    icon: <EntityPortrait image={null} alt={name} size="sm" className="size-6 [&>svg]:size-3.5" />,
    node:
      e.heroId != null ? (
        <span className="inline-flex items-baseline gap-1.5">
          <Link href={`/heroes/${e.heroId}`} className={linkClass}>
            {name}
          </Link>
          <span className="text-muted-foreground">英雄符令</span>
        </span>
      ) : (
        <span className="font-medium">{name}</span>
      ),
    text: e.heroName ? `${e.heroName} 英雄符令` : name,
  };
}

function HiddenNote() {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
      <LockIcon className="size-4 shrink-0" aria-hidden />
      {HIDDEN_NOTE}
    </p>
  );
}

function MysteryBody({ contents }: { contents: MysteryBoxContents }) {
  if (!contents.info.hasData) return <HiddenNote />;
  const rows: MysteryTableRow[] = contents.entries.map((e) => {
    const n = entryName(e);
    return {
      key: String(e.seq),
      icon: n.icon,
      name: n.node,
      search: n.text,
      qty: `×${e.qty.toLocaleString("zh-TW")}`,
      prob: formatProb(e.prob),
      rare: e.prob < RARE_BELOW,
      nested: e.contents ? <NestedBox contents={e.contents} /> : null,
    };
  });
  return <MysteryTable rows={rows} />;
}

function NestedBox({ contents }: { contents: MysteryBoxContents }) {
  const drop = formatDrop(contents.info);
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {contents.info.boxName ?? `道具 #${contents.info.boxItemId}`} 的內容
        {drop && ` · ${drop}`}
      </p>
      <MysteryBody contents={contents} />
    </div>
  );
}

/** 2A：這個道具是隨機寶箱 → 「開啟可能獲得（隨機）」。 */
export function MysteryContentsSection({ contents }: { contents: MysteryBoxContents | null }) {
  if (!contents) return null;
  const { info } = contents;
  return (
    <ItemSubSection
      title="開啟可能獲得（隨機）"
      summary={info.hasData ? [formatDrop(info), `共 ${contents.entries.length} 項`].filter(Boolean).join(" · ") : undefined}
      footer={
        info.hasData
          ? "機率為單次抽取的機率，依客戶端資料計算；每次開出多樣時，每一樣各自依此機率抽出。"
          : undefined
      }
    >
      <MysteryBody contents={contents} />
    </ItemSubSection>
  );
}

// =========================================================================
// 2B：可從這些寶箱開出
// =========================================================================

interface SourceGroup {
  first: MysterySource;
  seqs: MysterySource[];
  total: number;
}

function groupSources(rows: MysterySource[]): SourceGroup[] {
  const map = new Map<number, SourceGroup>();
  for (const r of rows) {
    const g = map.get(r.boxItemId);
    if (g) {
      g.seqs.push(r);
      g.total += r.prob;
    } else {
      map.set(r.boxItemId, { first: r, seqs: [r], total: r.prob });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.first.boxItemId - b.first.boxItemId);
}

function qtyRange(seqs: MysterySource[]): string {
  const qs = seqs.map((s) => s.qty);
  const min = Math.min(...qs);
  const max = Math.max(...qs);
  return min === max ? `×${min}` : `×${min}–${max}`;
}

export function MysterySourcesSection({ sources }: { sources: MysterySource[] }) {
  if (sources.length === 0) return null;
  const groups = groupSources(sources);
  return (
    <ItemSubSection
      title="可從這些寶箱開出（隨機）"
      summary={`${groups.length} 種寶箱`}
      footer="機率為開啟一次時抽中此道具的機率；同一寶箱可開出不同數量時，另列各數量的機率並加總。"
    >
      <ShowMoreList>
        {groups.map(({ first, seqs, total }) => {
          const name = first.boxName ?? `道具 #${first.boxItemId}`;
          const multi = seqs.length > 1;
          return (
            <LinkListRow key={first.boxItemId} href={`/items/${first.boxItemId}`}>
              <ItemIcon image={first.boxIcon} alt={name} className="size-6 self-center" />
              <span className="font-medium">{name}</span>
              <span className="font-mono text-xs text-muted-foreground">#{first.boxItemId}</span>
              <span className="font-mono text-xs text-muted-foreground">{qtyRange(seqs)}</span>
              <span className="ml-auto font-mono text-sm tabular-nums">
                {multi && <span className="mr-1 text-xs text-muted-foreground">合計</span>}
                {formatProb(total)}
              </span>
              {multi && (
                <span className="basis-full pl-9 font-mono text-xs leading-relaxed text-muted-foreground">
                  {seqs.map((s) => `×${s.qty} ${formatProb(s.prob)}`).join(" · ")}
                </span>
              )}
            </LinkListRow>
          );
        })}
      </ShowMoreList>
    </ItemSubSection>
  );
}
