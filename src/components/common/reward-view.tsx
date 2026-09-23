import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpenIcon,
  CoinsIcon,
  CrownIcon,
  FlameIcon,
  HeartIcon,
  HourglassIcon,
  SparklesIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ItemIcon } from "@/components/common/item-icon";
import type { Reward } from "@/lib/types/mission-logic";

// 任務獎勵與禮盒開箱共用的獎勵呈現（mission_rewards / item_box_rewards 同形狀）。

/** 與 ItemIcon 同尺寸、同外框的 lucide 圖示框，讓道具列與非道具列對齊。 */
export function IconFrame({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground"
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

export const linkClass = "font-medium underline-offset-2 hover:underline";
export const num = (n: number) => n.toLocaleString("zh-TW");
/** 小數最多留一位，整數不帶 .0。 */
export const trim = (n: number) => String(Number(n.toFixed(1)));

export function formatDuration(min: number): string {
  if (min >= 1440) return `${trim(min / 1440)} 天`;
  if (min >= 60) return `${trim(min / 60)} 小時`;
  return `${min} 分`;
}

export function TimedBadge({ durationMin }: { durationMin: number }) {
  return (
    <Badge variant="outline" className="font-normal">
      <HourglassIcon aria-hidden />
      限時 {formatDuration(durationMin)}
    </Badge>
  );
}

export interface RewardView {
  lead: ReactNode;
  label: ReactNode;
  value: string | null;
  extra?: ReactNode;
}

export function rewardView(r: Reward): RewardView {
  const qty = r.qty ?? null;
  const icon = (i: LucideIcon) => <IconFrame icon={i} />;
  const plain = (i: LucideIcon, label: string, value: string | null): RewardView => ({
    lead: icon(i),
    label: <span className="text-muted-foreground">{label}</span>,
    value,
  });

  switch (r.type) {
    case "item":
    case "timed_item":
    case "take_item": {
      const name = r.resolved.itemName ?? `道具 #${r.refId}`;
      return {
        lead: <ItemIcon image={r.resolved.itemIcon} alt={name} className="size-6" />,
        label:
          r.refId != null ? (
            <Link href={`/items/${r.refId}`} className={linkClass}>
              {name}
            </Link>
          ) : (
            <span className="font-medium">{name}</span>
          ),
        value: qty != null ? `×${qty}` : null,
        extra:
          r.type === "timed_item" && r.durationMin != null ? <TimedBadge durationMin={r.durationMin} /> : null,
      };
    }
    case "exp":
      return plain(StarIcon, "經驗值", qty != null ? num(qty) : null);
    case "exp_pct":
      return plain(StarIcon, "經驗值（依等級比例）", qty != null ? `${qty}%` : null);
    case "gold":
    case "pay_gold":
      return plain(CoinsIcon, "銀兩", qty != null ? num(qty) : null);
    case "charisma":
    case "pay_charisma":
      return plain(SparklesIcon, "魅力", qty != null ? num(qty) : null);
    case "intimacy":
      return plain(HeartIcon, "親密度", qty != null ? `${trim(qty / 100)} 點` : null);
    case "aura":
      return plain(FlameIcon, "靈氣", qty != null ? num(qty) : null);
    case "hero_token": {
      const name = r.resolved.heroName ?? "英雄";
      return {
        lead: icon(CrownIcon),
        label: (
          <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
            {r.resolved.heroId != null ? (
              <Link href={`/heroes/${r.resolved.heroId}`} className={linkClass}>
                {name}
              </Link>
            ) : (
              <span className="font-medium">{name}</span>
            )}
            <span className="text-muted-foreground">英雄符令</span>
          </span>
        ),
        value: qty != null ? `×${qty}` : null,
      };
    }
    case "skill": {
      const name = r.resolved.magicName ?? `技能 #${r.resolved.magicId}`;
      return {
        lead: icon(BookOpenIcon),
        label:
          r.resolved.magicId != null ? (
            <Link href={`/skills/${r.resolved.magicId}?level=${r.resolved.level}`} className={linkClass}>
              {name}
            </Link>
          ) : (
            <span className="font-medium">{name}</span>
          ),
        value: r.resolved.level != null ? `Lv${r.resolved.level}` : null,
      };
    }
  }
}

/** 一列獎勵的內容（外層 li / 版面由呼叫端決定）；trailing 接在數量之後。 */
export function RewardLine({ reward, trailing }: { reward: Reward; trailing?: ReactNode }) {
  const v = rewardView(reward);
  return (
    <>
      {v.lead}
      {v.label}
      {v.extra}
      {v.value && <span className="ml-auto font-mono text-xs text-muted-foreground">{v.value}</span>}
      {trailing}
    </>
  );
}
