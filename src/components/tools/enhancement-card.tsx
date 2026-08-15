import Link from "next/link";
import { ChevronRightIcon, ShieldXIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ItemIcon } from "@/components/common/item-icon";
import { isCompoundPlayerLevel } from "@/lib/constants/compound";
import { formatBonusRange, formatProb } from "@/lib/format/compound";
import type { CompoundOutput, EnhancementResult } from "@/lib/queries/compound";
import type { EntityImage } from "@/lib/queries/images";
import { cn } from "@/lib/utils";

const PROB_SCALE = 1_000_000;

/** 「查無」是資料檔沒有這個欄位，與「0」語意不同，不可互換。 */
const NOT_RECORDED = "查無";

/**
 * 級距顏色階梯：低段青瓷 → 中段鎏金 → 高段朱砂。越紅代表越靠上限、越稀有。
 * 直接混既有 chart token，不新增 CSS 變數。
 * 中間經過鎏金是必要的 — 青瓷直接混朱砂會在中段變成濁灰。
 */
function tierColor(index: number, total: number): string {
  const ratio = total <= 1 ? 1 : index / (total - 1);
  if (ratio <= 0.5) {
    const t = Math.round(ratio * 2 * 100);
    return `color-mix(in oklch, var(--chart-4) ${t}%, var(--chart-2))`;
  }
  const t = Math.round((ratio - 0.5) * 2 * 100);
  return `color-mix(in oklch, var(--chart-1) ${t}%, var(--chart-4))`;
}

/** 失敗（無事發生）用斜線紋，避免被誤讀成某一段加值。 */
const FAIL_FILL =
  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--muted-foreground) 34%, transparent) 0 4px, transparent 4px 8px), color-mix(in oklab, var(--muted-foreground) 12%, transparent)";

interface Slice {
  key: string;
  label: string;
  prob: number;
  fill: string;
  emphasis?: boolean;
}

/**
 * 把一條配方的整個機率盤攤平成同一把尺：
 * 目標屬性的各級距（低→高）＋ 其他屬性 ＋ 沒有效果，總和恆為 1,000,000。
 */
function buildSlices(outputs: CompoundOutput[], rawType: string): Slice[] {
  const target = outputs
    .filter((o) => o.kind === "bonus" && o.rawType === rawType && o.prob > 0)
    .sort((a, b) => (a.max ?? 0) - (b.max ?? 0) || (a.min ?? 0) - (b.min ?? 0));

  const slices: Slice[] = target.map((o, i) => ({
    key: `t${i}`,
    label: formatBonusRange(o.min ?? 0, o.max ?? 0),
    prob: o.prob,
    fill: tierColor(i, target.length),
    emphasis: i === target.length - 1 && target.length > 1,
  }));

  // 同一次嘗試只會出一種結果 — 其他屬性必須看得見，否則玩家會以為可以一起拿到
  const others = new Map<string, { label: string; prob: number }>();
  for (const o of outputs) {
    if (o.rawType === rawType || o.prob <= 0) continue;
    const prev = others.get(o.rawType);
    others.set(o.rawType, { label: o.label, prob: (prev?.prob ?? 0) + o.prob });
  }
  for (const [key, o] of others) {
    slices.push({
      key: `o:${key}`,
      label: `改為加 ${o.label}`,
      prob: o.prob,
      fill: "color-mix(in oklab, var(--chart-3) 55%, transparent)",
    });
  }

  const used = slices.reduce((sum, s) => sum + s.prob, 0);
  const idle = Math.max(0, PROB_SCALE - used);
  if (idle > 0) {
    slices.push({ key: "idle", label: "沒有效果", prob: idle, fill: FAIL_FILL });
  }
  return slices;
}

function pctWidth(prob: number): string {
  return `${(prob / PROB_SCALE) * 100}%`;
}

/** 期望顆數是本站推導值，四捨五入到小數一位；無法計算時顯示「查無」。 */
function formatExpected(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return NOT_RECORDED;
  return `${Math.round(value * 10) / 10} 顆`;
}

function EstimateMark() {
  return (
    <Badge
      variant="outline"
      className="h-3.5 rounded px-1 text-[0.6rem] font-normal text-muted-foreground"
    >
      推估
    </Badge>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[0.65rem] text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

function SliceRow({ slice }: { slice: Slice }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.9rem] items-center gap-2">
      <span
        className={cn(
          "truncate font-mono text-[0.7rem]",
          slice.key === "idle" && "font-sans text-muted-foreground",
          slice.key.startsWith("o:") && "font-sans text-muted-foreground",
        )}
      >
        {slice.label}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full"
          style={{ width: pctWidth(slice.prob), background: slice.fill }}
        />
      </span>
      <span
        className={cn(
          "text-right font-mono text-[0.7rem] tabular-nums",
          slice.emphasis ? "font-bold text-primary" : "text-muted-foreground",
        )}
      >
        {formatProb(slice.prob)}
      </span>
    </div>
  );
}

/**
 * 分段分佈。只在「多級距」或「同配方還會產出別的屬性」時渲染 —
 * 單段 100% 的配方沒有這個複雜度，不該被硬套上。
 *
 * 用原生 <details>：Server Component 不需要 client JS 就能展開。
 */
function Distribution({ slices, topLabel }: { slices: Slice[]; topLabel: string | null }) {
  const segmentCount = slices.filter((s) => s.key.startsWith("t")).length;
  const top = slices.find((s) => s.emphasis);

  return (
    <details className="group/dist mt-2.5 border-t border-dashed border-border/60 pt-2.5">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="size-3.5 shrink-0 transition-transform group-open/dist:rotate-90"
          aria-hidden
        />
        <span>
          {segmentCount > 1 ? `分 ${segmentCount} 段` : "產出分佈"}
          {top && topLabel && (
            <>
              <span className="mx-1.5 text-border">|</span>
              上限 <span className="font-mono text-foreground">{topLabel}</span> 佔{" "}
              <span className="font-mono font-medium text-primary">{formatProb(top.prob)}</span>
            </>
          )}
        </span>
      </summary>

      <div className="mt-2.5 rounded-md border border-border/60 bg-background/40 p-2.5">
        <p className="mb-1.5 text-[0.65rem] leading-relaxed text-muted-foreground">
          單次嘗試的完整結果分佈，含沒有效果的部分，加總為 100%。
        </p>
        <div
          className="flex h-3 overflow-hidden rounded-sm bg-muted"
          role="img"
          aria-label={slices
            .map((s) => `${s.label} ${formatProb(s.prob)}`)
            .join("、")}
        >
          {slices.map((s) => (
            <span
              key={s.key}
              className="block h-full border-r border-background/60 last:border-r-0"
              style={{ width: pctWidth(s.prob), background: s.fill }}
            />
          ))}
        </div>
        <div className="mt-2.5 flex flex-col gap-1">
          {slices.map((s) => (
            <SliceRow key={s.key} slice={s} />
          ))}
        </div>
        {top && topLabel && (
          <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">
            上限那一段（<span className="font-mono">{topLabel}</span>）只有{" "}
            <span className="font-mono text-foreground">{formatProb(top.prob)}</span>
            。合併後的範圍是所有級距的頭尾，不是預期會拿到的值。
          </p>
        )}
      </div>
    </details>
  );
}

export function EnhancementCard({
  result,
  iconMap,
}: {
  result: EnhancementResult;
  iconMap: Map<number, EntityImage>;
}) {
  const { use, target, expectedMaterials } = result;
  const slices = buildSlices(use.outputs, target.rawType);
  const hasDistribution = target.segments > 1 || slices.some((s) => s.key.startsWith("o:"));
  const topSlice = slices.find((s) => s.emphasis);
  const showLevel = isCompoundPlayerLevel(use.level);
  const core = use.coreMaterial;
  const sameName = core?.name === use.name;

  return (
    <article className="rounded-lg border border-border/60 bg-card p-3.5 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-heading text-[0.95rem] leading-snug font-medium">
            {use.name ?? `#${use.id}`}
          </h4>
          {core && (
            <span className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <ItemIcon
                image={iconMap.get(core.id) ?? null}
                alt={core.name}
                className="size-4 rounded-sm"
              />
              <Link
                href={`/items/${core.id}`}
                className="truncate underline-offset-2 hover:text-foreground hover:underline"
              >
                {sameName ? "同名材料" : core.name}
              </Link>
            </span>
          )}
        </div>

        <div className="shrink-0 text-right">
          <span
            className={cn(
              "block font-mono leading-none font-bold text-primary",
              target.min === target.max ? "text-xl" : "text-base",
            )}
          >
            {formatBonusRange(target.min, target.max)}
          </span>
          <span className="mt-1 block text-[0.6rem] text-muted-foreground">
            {target.label}
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 border-t border-dashed border-border/60 pt-2.5 text-xs">
        <Meta label="機率">
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              target.prob >= PROB_SCALE && "text-chart-2",
            )}
          >
            {formatProb(target.prob)}
          </span>
        </Meta>

        <span className="flex items-baseline gap-1">
          <span className="flex items-baseline gap-1 text-[0.65rem] text-muted-foreground">
            期望顆數
            <EstimateMark />
          </span>
          <span className="font-mono font-medium tabular-nums">
            {formatExpected(expectedMaterials)}
          </span>
        </span>

        {use.sideMaterials[0] && (
          <Meta label="槽位">
            <span className="font-medium">{use.sideMaterials[0].name}</span>
          </Meta>
        )}

        {use.groupName && (
          <Meta label="群組">
            <span className="font-medium">{use.groupName}</span>
          </Meta>
        )}

        {showLevel && (
          <Meta label="等級">
            <span className="font-mono font-medium tabular-nums">Lv {use.level}</span>
          </Meta>
        )}

        <Meta label="金錢">
          {use.money == null ? (
            <span className="text-[0.7rem] text-muted-foreground italic">{NOT_RECORDED}</span>
          ) : (
            <span className="font-mono font-medium tabular-nums">
              {use.money.toLocaleString()}
            </span>
          )}
        </Meta>

        <Meta label="失敗回收">
          {use.failItem == null ? (
            <span className="text-[0.7rem] text-muted-foreground italic">{NOT_RECORDED}</span>
          ) : (
            <Link
              href={`/items/${use.failItem.id}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {use.failItem.name}
            </Link>
          )}
        </Meta>

        {use.equipCrash && (
          <Badge
            variant="outline"
            className="border-chart-4/50 bg-chart-4/10 text-chart-4 h-5 gap-1 px-1.5 text-[0.65rem]"
          >
            <ShieldXIcon aria-hidden />
            會毀裝
          </Badge>
        )}
      </div>

      {hasDistribution && (
        <Distribution
          slices={slices}
          topLabel={topSlice ? topSlice.label : null}
        />
      )}
    </article>
  );
}
