import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpenIcon,
  ChevronsUpIcon,
  CircleDotIcon,
  CoinsIcon,
  CrownIcon,
  DumbbellIcon,
  FlagIcon,
  FlameIcon,
  HeartIcon,
  HourglassIcon,
  LogInIcon,
  ScrollTextIcon,
  SparklesIcon,
  StarIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ItemIcon } from "@/components/common/item-icon";
import { GameText } from "@/components/common/game-text";
import type { MissionStep } from "@/lib/types/mission";
import type {
  ConditionKind,
  MissionCondition,
  MissionFlowStep,
  MissionLogic,
  MissionRequirementGroup,
  Reward,
} from "@/lib/types/mission-logic";

const MISSING = "客戶端資料未記載";

function Missing() {
  return <span className="text-xs text-muted-foreground">{MISSING}</span>;
}

/** 與 ItemIcon 同尺寸、同外框的 lucide 圖示框，讓道具列與非道具列對齊。 */
function IconFrame({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground"
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

const linkClass = "font-medium underline-offset-2 hover:underline";
const num = (n: number) => n.toLocaleString("zh-TW");
/** 小數最多留一位，整數不帶 .0。 */
const trim = (n: number) => String(Number(n.toFixed(1)));

// =========================================================================
// 接取與交付
// =========================================================================

/** 1 時辰 = 10 分；1 遊戲天 = 120 分。 */
export function formatTimer(minutes: number): string {
  const base = `${num(minutes)} 分（${trim(minutes / 10)} 時辰`;
  return minutes >= 120 ? `${base}，約 ${trim(minutes / 120)} 遊戲天）` : `${base}）`;
}

function InfoCell({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function MissionAcceptSection({ logic }: { logic: MissionLogic }) {
  const join = (xs: string[]) => (xs.length > 0 ? xs.join("、") : <Missing />);
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">接取與交付</h2>
      <dl className="grid divide-y divide-border/60 rounded-lg border border-border/60 bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <InfoCell icon={LogInIcon} label="接取 NPC">
          {join(logic.acceptNpcs)}
        </InfoCell>
        <InfoCell icon={FlagIcon} label="交付 NPC">
          {join(logic.completeNpcs)}
        </InfoCell>
        <InfoCell icon={HourglassIcon} label="限時">
          {logic.timers.length > 0 ? (
            <span className="flex flex-col gap-0.5">
              {logic.timers.map((t) => (
                <span key={t.minutes}>{formatTimer(t.minutes)}</span>
              ))}
            </span>
          ) : (
            <Missing />
          )}
        </InfoCell>
      </dl>
    </section>
  );
}

// =========================================================================
// 接取條件
// =========================================================================

const KIND_ICON: Record<Exclude<ConditionKind, "item">, LucideIcon> = {
  level: ChevronsUpIcon,
  stat: DumbbellIcon,
  charisma: SparklesIcon,
  intimacy: HeartIcon,
  gold: CoinsIcon,
  faction: FlagIcon,
  gender: UserIcon,
  skill: BookOpenIcon,
  prereq: ScrollTextIcon,
  other: CircleDotIcon,
};

const CN_DIGITS = "零一二三四五六七八九";
/** 1..99 → 一..九十九（條件分頁標籤用）。 */
export function cnNumber(n: number): string {
  if (n < 10) return CN_DIGITS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens === 1 ? "" : CN_DIGITS[tens]}十${ones === 0 ? "" : CN_DIGITS[ones]}`;
}

/** summary 的 ">=" 換成 "≥"；否定條件剝掉外層「非[...]」，由呈現端自己加語氣。 */
function plainSummary(c: MissionCondition): string {
  const s = c.negated ? c.summary.replace(/^非\[(.*)\]$/, "$1") : c.summary;
  return s.replace(/>=/g, "≥").replace(/<=/g, "≤");
}

function ConditionText({ c }: { c: MissionCondition }) {
  if (c.item) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted-foreground">{c.negated ? "不可持有" : "持有"}</span>
        <Link href={`/items/${c.item.itemId}`} className={linkClass}>
          {c.item.itemName}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">×{c.item.qty}</span>
      </span>
    );
  }
  if (c.skill) {
    const name = c.skill.magicName ?? `技能 #${c.skill.magicId}`;
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted-foreground">{c.negated ? "未習得" : "習得"}</span>
        <Link href={`/skills/${c.skill.magicId}?level=${c.skill.level}`} className={linkClass}>
          {name}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">Lv{c.skill.level}</span>
      </span>
    );
  }
  if (c.prereq) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted-foreground">{c.negated ? "尚未完成任務" : "已完成任務"}</span>
        <Link href={`/missions/${c.prereq.missionId}`} className={linkClass}>
          {c.prereq.missionName ?? `任務 ${c.prereq.missionId}`}
        </Link>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {c.negated && <span className="text-muted-foreground">不可符合</span>}
      <span>{plainSummary(c)}</span>
    </span>
  );
}

/**
 * 「推測」小標：不用虛線底線，因為這頁的虛線底線已經代表「可點的連結」。
 * 文字本身在手機上也看得到，tooltip 只是補一句說明。
 */
function LikelyMark() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        className="ml-1.5 cursor-help rounded-sm px-1 align-baseline text-[0.7rem] text-muted-foreground/80 ring-1 ring-border/60 outline-none focus-visible:ring-ring"
      >
        推測
      </TooltipTrigger>
      <TooltipContent>語意為推測，可能與遊戲實際判定不同</TooltipContent>
    </Tooltip>
  );
}

function ConditionList({ conditions }: { conditions: MissionCondition[] }) {
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
      {conditions.map((c, i) => {
        // 連續幾條共用同一句 NPC 回話時，只在最後一條下方顯示一次。
        const showReject = c.rejectText != null && conditions[i + 1]?.rejectText !== c.rejectText;
        return (
          <li key={i} className="flex gap-2.5 px-3 py-2">
            {c.item ? (
              <ItemIcon image={c.item.icon} alt={c.item.itemName} className="size-6" />
            ) : (
              <IconFrame icon={KIND_ICON[c.kind === "item" ? "other" : c.kind]} />
            )}
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5 text-sm">
              <div>
                <ConditionText c={c} />
                {c.likely && <LikelyMark />}
              </div>
              {showReject && (
                <blockquote className="border-l-2 border-border pl-2.5 text-xs leading-relaxed text-muted-foreground">
                  <span className="text-muted-foreground/70">不符時 NPC：</span>「<GameText text={c.rejectText!} />」
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function modeHint(g: MissionRequirementGroup) {
  return g.mode === 1 ? "以下任一成立即可" : "以下全部成立才可接取";
}

/** 完全相同的條件組（上游常見重複）只留一組，擇一語意不變。 */
function dedupeGroups(groups: MissionRequirementGroup[]): MissionRequirementGroup[] {
  const seen = new Set<string>();
  return groups.filter((g) => {
    const sig = `${g.mode}|${g.conditions.map((c) => [c.op, c.negated, c.a0, c.a1, c.a2, c.a3, c.a4].join(",")).join(";")}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

export function MissionRequirementSection({ groups: raw }: { groups: MissionRequirementGroup[] }) {
  const groups = dedupeGroups(raw);
  const hasLikely = groups.some((g) => g.conditions.some((c) => c.likely));

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-medium">接取條件</h2>
        {groups.length > 1 && (
          <span className="text-xs text-muted-foreground">
            共 {groups.length} 組 · 符合任一組即可
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">無接取條件資料</p>
      ) : groups.length === 1 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{modeHint(groups[0])}</p>
          <ConditionList conditions={groups[0].conditions} />
        </div>
      ) : (
        <Tabs defaultValue={0}>
          <TabsList className="flex-wrap justify-start group-data-horizontal/tabs:h-auto">
            {groups.map((g, i) => (
              <TabsTrigger key={i} value={i} className="h-7 flex-none px-2.5">
                條件{cnNumber(i + 1)}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map((g, i) => (
            <TabsContent key={i} value={i} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{modeHint(g)}</p>
              <ConditionList conditions={g.conditions} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {hasLikely && (
        <p className="text-xs text-muted-foreground">
          標「推測」的條件是依客戶端資料推敲出的意思，尚未完全確認。
        </p>
      )}
    </section>
  );
}

// =========================================================================
// 完成獎勵 / 需交付
// =========================================================================

function formatDuration(min: number): string {
  if (min >= 1440) return `${trim(min / 1440)} 天`;
  if (min >= 60) return `${trim(min / 60)} 小時`;
  return `${min} 分`;
}

interface RewardView {
  lead: ReactNode;
  label: ReactNode;
  value: string | null;
  extra?: ReactNode;
}

function rewardView(r: Reward): RewardView {
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
          r.type === "timed_item" && r.durationMin != null ? (
            <Badge variant="outline" className="font-normal">
              <HourglassIcon aria-hidden />
              限時 {formatDuration(r.durationMin)}
            </Badge>
          ) : null,
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

function RewardBlock({ title, rewards }: { title: string; rewards: Reward[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium">{title}</h2>
      {rewards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-2.5">
          <Missing />
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
          {rewards.map((r, i) => {
            const v = rewardView(r);
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm">
                {v.lead}
                {v.label}
                {v.extra}
                {v.value && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{v.value}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MissionRewardSection({ logic }: { logic: MissionLogic }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <RewardBlock title="完成獎勵" rewards={logic.rewards} />
      <RewardBlock title="需交付" rewards={logic.deliveries} />
    </section>
  );
}

// =========================================================================
// 任務流程（說明步驟 × 事件流程對齊）
// =========================================================================

export interface FlowRow {
  key: string;
  kind: "accept" | "step" | "complete";
  /** 顯示用步驟序號（1-based，對應 mission_steps.step_index）。 */
  index: number;
  step: MissionStep | null;
  flow: MissionFlowStep | null;
}

/**
 * 把任務說明步驟（mission_steps，1-based）與事件流程（flow，0 = 接取、N = 完成第 N 步、
 * 15 = 任務完成）併成一條時間軸：flow step N 觸發後進入說明的 Step N+1。
 * ponytail: 純序號對齊的推測，上游沒有直接對應欄位；對不上時就各自顯示有的部分。
 */
export function buildFlowRows(steps: MissionStep[], flow: MissionFlowStep[]): FlowRow[] {
  const stepByIndex = new Map(steps.map((s) => [s.index, s]));
  const flowByStep = new Map(flow.map((f) => [f.step, f]));
  const maxIndex = Math.max(
    0,
    ...steps.map((s) => s.index),
    ...flow.filter((f) => f.step < 15).map((f) => f.step + 1),
  );
  const rows: FlowRow[] = [];
  for (let i = 1; i <= maxIndex; i++) {
    const step = stepByIndex.get(i) ?? null;
    const f = flowByStep.get(i - 1) ?? null;
    if (!step && !f) continue;
    rows.push({ key: `s${i}`, kind: i === 1 && f ? "accept" : "step", index: i, step, flow: f });
  }
  const done = flowByStep.get(15);
  if (done) rows.push({ key: "done", kind: "complete", index: 15, step: null, flow: done });
  return rows;
}
