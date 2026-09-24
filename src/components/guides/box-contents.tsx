import { ChevronDownIcon, GiftIcon, SplitIcon } from "lucide-react";
import { getBoxItemIds, getItemBoxContents } from "@/lib/queries/mission-logic";
import { getItemById } from "@/lib/queries/items";
import { getGuideRef, type GuideRef } from "@/lib/guide-refs";
import { formatDuration, num, rewardView } from "@/components/common/reward-view";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ItemBoxOption, Reward } from "@/lib/types/mission-logic";
import { cn } from "@/lib/utils";
import { GuideRefTag } from "./guide-ref-tag";

/*
 * 禮盒鏈：禮盒裡常再放「下一級才能開」的禮盒。getItemBoxContents 的巢狀樹在有選項時
 * 每個選項都各自展開下一層（8 門派 × 8 門派…會指數爆炸），所以這裡每層只取一層
 * （maxDepth=1），自己沿著「所有選項都有的那個下一級禮盒」往下走，攤平成等級階梯。
 */

const MAX_TIERS = 30; // ponytail: 防呆上限；現有最長的鏈十來層
const OPEN_TIERS = 3; // 預設展開幾層，其餘收進「展開後面 N 層」

interface Choice {
  label: string;
  rewards: Reward[];
}

interface Tier {
  box: GuideRef;
  level: number;
  /** 每個選項都有的東西（下一級禮盒已抽掉）。 */
  common: Reward[];
  /** 只有 1 組時為空；多組時是各選項扣掉共同物品後的差異。 */
  choices: Choice[];
  hasChoicePath: boolean;
}

const keyOf = (r: Reward) => `${r.type}:${r.refId}:${r.qty}:${r.durationMin}`;
const isItem = (r: Reward) => (r.type === "item" || r.type === "timed_item") && r.refId != null;

function splitOptions(options: ItemBoxOption[], seen: Set<number>, level: number) {
  const hits = new Map<string, number>();
  for (const o of options) {
    for (const k of new Set(o.rewards.map(keyOf))) hits.set(k, (hits.get(k) ?? 0) + 1);
  }
  const isCommon = (r: Reward) => hits.get(keyOf(r)) === options.length;
  // 每個選項都有、只是數量不同（如中金元寶 ×20 / ×16）：排在選項專屬的武器後面
  const inAll = (r: Reward) => options.every((o) => o.rewards.some((x) => x.type === r.type && x.refId === r.refId));
  const common = options[0].rewards.filter(isCommon);
  const boxes = getBoxItemIds(common.filter(isItem).map((r) => r.refId as number));
  // 同層可能有好幾個禮盒（如 Lv110 同時給高階俠士禮盒與極品紫魔丹）：等級最高、且不低於本層的才是鏈的下一站；
  // 低於本層的（經驗丹禮盒之類）當一般物品列出
  const next = common
    .filter((r) => isItem(r) && boxes.has(r.refId as number) && !seen.has(r.refId as number))
    .map((r) => ({ r, lv: getItemById(r.refId as number)?.level ?? 0 }))
    .filter((c) => c.lv >= level)
    .reduce<{ r: Reward; lv: number } | null>((best, c) => (best && best.lv >= c.lv ? best : c), null)?.r;
  return {
    common: common.filter((r) => r !== next),
    choices:
      options.length > 1
        ? options.map((o, i) => ({
            label: o.choicePath ?? `情況 ${i + 1}`,
            rewards: o.rewards.filter((r) => !isCommon(r)).sort((a, b) => Number(inAll(a)) - Number(inAll(b))),
          }))
        : [],
    next: next?.refId ?? null,
  };
}

function getChain(rootId: number, levels?: number, upTo?: number) {
  const tiers: Tier[] = [];
  const seen = new Set<number>();
  let id: number | null = rootId;
  let rest: { box: GuideRef; level: number } | null = null;
  while (id != null && tiers.length < MAX_TIERS) {
    const level = getItemById(id)?.level ?? 0;
    const box = getGuideRef("item", id);
    if (!box) break;
    if ((upTo != null && level > upTo) || (levels != null && tiers.length >= levels)) {
      rest = { box, level };
      break;
    }
    const options = getItemBoxContents(id, 1);
    if (options.length === 0) break;
    seen.add(id);
    const { common, choices, next } = splitOptions(options, seen, level);
    tiers.push({ box, level, common, choices, hasChoicePath: options.some((o) => o.choicePath != null) });
    id = next;
  }
  return { tiers, rest };
}

const lvText = (level: number) => (level > 0 ? `Lv ${level}` : "即開");

function RewardChip({ reward }: { reward: Reward }) {
  const ref = isItem(reward) ? getGuideRef("item", reward.refId as number) : null;
  if (ref) {
    const timed = reward.type === "timed_item" && reward.durationMin != null;
    return (
      <GuideRefTag data={ref} variant="chip">
        {reward.qty != null && reward.qty !== 1 && (
          <span className="text-muted-foreground shrink-0 font-mono text-[12px]">×{num(reward.qty)}</span>
        )}
        {timed && (
          <span className="text-muted-foreground shrink-0 text-[11.5px]">{formatDuration(reward.durationMin!)}</span>
        )}
      </GuideRefTag>
    );
  }
  // 非道具（銀兩、經驗…）沿用道具頁的呈現，不做預覽
  const v = rewardView(reward);
  return (
    <span className="bg-card inline-flex max-w-full items-center gap-2 rounded-lg border border-border/60 py-1 pr-2.5 pl-1 text-[13.5px] leading-tight [&>span:first-child]:size-7">
      {v.lead}
      {v.label}
      {v.value && <span className="text-muted-foreground font-mono text-[12px]">{v.value}</span>}
    </span>
  );
}

function Chips({ rewards }: { rewards: Reward[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rewards.map((r, i) => (
        <li key={i} className="max-w-full min-w-0">
          <RewardChip reward={r} />
        </li>
      ))}
    </ul>
  );
}

function TierRow({ tier, last }: { tier: Tier; last: boolean }) {
  return (
    <li
      className={cn(
        "relative pb-6 pl-7",
        !last && "before:bg-border before:absolute before:top-5 before:bottom-0 before:left-[6.5px] before:w-0.5",
        last && "pb-1",
      )}
    >
      <span
        aria-hidden
        className="bg-card absolute top-[5px] left-0 box-border size-[15px] rounded-full border-[3px] border-(--stop)"
      />
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="font-mono text-[13.5px] font-semibold tracking-tight text-(--stop-ink)">
          {lvText(tier.level)}
        </span>
        <span className="font-heading text-[15.5px] leading-snug">
          <GuideRefTag data={tier.box} />
        </span>
      </div>
      {tier.common.length > 0 && <Chips rewards={tier.common} />}
      {tier.choices.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-dashed border-(--stop)/40 bg-(--stop)/5 p-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] leading-snug">
            <SplitIcon className="size-3.5 shrink-0 text-(--stop-ink)" aria-hidden />
            {tier.hasChoicePath ? (
              <span>
                開啟時<b className="font-medium text-(--stop-ink)">擇一</b>
                ，以下 {tier.choices.length} 種只能拿一種
              </span>
            ) : (
              <span>依條件只會拿到下面其中一種</span>
            )}
          </p>
          {/* 手機：一列一個選項（名稱在左）；桌機：三欄小卡 */}
          <ul className="grid gap-1.5 sm:grid-cols-3">
            {tier.choices.map((c) => (
              <li
                key={c.label}
                className="bg-card/70 grid min-w-0 grid-cols-[6.5em_minmax(0,1fr)] items-center gap-x-2 rounded-md border border-border/60 p-2 sm:block"
              >
                <p className="text-muted-foreground text-[12px] leading-snug sm:mb-1.5">{c.label}</p>
                {c.rewards.length > 0 ? (
                  <Chips rewards={c.rewards} />
                ) : (
                  <p className="text-muted-foreground text-[12px]">只有共同物品</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/**
 * 攻略內文用：禮盒（鏈）內容，依開啟等級攤平成階梯。
 * - levels：只顯示前幾層；upTo：只顯示開啟等級 ≤ upTo 的層。兩者都給取較嚴的。
 * - 查無禮盒內容回 null。
 */
export function BoxContents({ id, levels, upTo }: { id: number | string; levels?: number; upTo?: number }) {
  const rootId = Number(id);
  if (!Number.isInteger(rootId) || rootId <= 0) return null;
  const { tiers, rest } = getChain(rootId, levels, upTo);
  if (tiers.length === 0) return null;

  // 只多一層就不收了，省一次點擊
  const cut = tiers.length > OPEN_TIERS + 1 ? OPEN_TIERS : tiers.length;
  const shown = tiers.slice(0, cut);
  const hidden = tiers.slice(cut);
  const first = tiers[0].level;
  const lastLv = tiers.at(-1)!.level;

  return (
    <section className="bg-card my-6 overflow-hidden rounded-xl border">
      <header className="bg-muted flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b px-4 py-3">
        <GiftIcon className="text-muted-foreground size-4" aria-hidden />
        <span className="font-heading text-[14.5px]">{tiers[0].box.name}・開箱路線</span>
        <span className="text-muted-foreground ml-auto text-[12.5px]">
          {tiers.length > 1 ? (
            <>
              共 <span className="font-mono">{tiers.length}</span> 層・
              <span className="font-mono">
                {lvText(first)} → {lvText(lastLv)}
              </span>
            </>
          ) : (
            lvText(first)
          )}
        </span>
      </header>

      <div className="px-4 pt-4 pb-3 sm:px-5">
        <ol>
          {shown.map((t, i) => (
            <TierRow key={t.box.id} tier={t} last={i === tiers.length - 1} />
          ))}
        </ol>
        {hidden.length > 0 && (
          <Collapsible>
            <CollapsiblePanel>
              <ol>
                {hidden.map((t, i) => (
                  <TierRow key={t.box.id} tier={t} last={i === hidden.length - 1} />
                ))}
              </ol>
            </CollapsiblePanel>
            <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground hover:bg-muted/50 -ml-1.5 inline-flex w-auto items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px]">
              <ChevronDownIcon
                className="size-4 motion-safe:transition-transform group-data-panel-open:rotate-180"
                aria-hidden
              />
              <span className="group-data-panel-open:hidden">
                展開後面 {hidden.length} 層（{lvText(hidden[0].level)} → {lvText(lastLv)}）
              </span>
              <span className="hidden group-data-panel-open:inline">收合</span>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {rest && (
        <footer className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-dashed px-4 py-2.5 text-[12.5px] sm:px-5">
          再往下是
          <GuideRefTag data={rest.box} variant="chip" />
          {rest.level > 0 && <span>{lvText(rest.level)} 才能開</span>}
        </footer>
      )}
    </section>
  );
}
