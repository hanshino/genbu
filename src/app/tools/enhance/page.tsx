import type { Metadata } from "next";
import {
  BanIcon,
  CircleAlertIcon,
  CircleDotIcon,
  FlaskConicalIcon,
  LayersIcon,
  ScrollTextIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioOption } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnhancementCard } from "@/components/tools/enhancement-card";
import { collectCompoundItemIds } from "@/lib/compound-grouping";
import { formatBonusRange, formatProb } from "@/lib/format/compound";
import {
  DEFAULT_ENHANCEMENT_SEARCH,
  ENHANCEMENT_BONUS_TYPES,
  bonusLabel,
  getEnhancementsByBonus,
  parseEnhancementSearchParams,
  sortEnhancements,
  type EnhancementFamily,
  type EnhancementResult,
} from "@/lib/queries/compound";
import { getItemIconMap } from "@/lib/queries/images";
import { EQUIPMENT_SLOT_LABELS, type EquipmentSlotKind } from "@/lib/types/compound";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "強化查詢 · 玄武",
  description: "選一個想加的屬性，反查加得到它的真元、魂珠與魂石配方。",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type ResultFamily = Exclude<EnhancementFamily, "all">;

/** 分組順序：真元 → 魂珠 → 其他 → 魂石。魂石擺最後，因為它常常是 0。 */
const FAMILY_ORDER: readonly ResultFamily[] = ["yuan", "pearl", "stone", "other"];
const FAMILY_GROUP_ORDER: readonly ResultFamily[] = ["yuan", "pearl", "other", "stone"];

const FAMILY_LABELS: Record<ResultFamily, string> = {
  yuan: "真元",
  pearl: "魂珠",
  other: "其他",
  stone: "魂石",
};

/** 各家族的資料特性說明。都是查得到的事實，不是攻略建議。 */
const FAMILY_NOTES: Record<ResultFamily, string> = {
  yuan: "多為單段固定加值、一次成功，資料上沒有毀裝標記。",
  pearl: "加值是多個級距合併的結果，實際抽到哪一段看運氣，且資料上標記會毀裝。",
  other: "早期的「◯◯強化裝備」配方，加值小但單段。這一類多半有等級資料。",
  stone: "以魂石為材料的配方。魂石加不到的屬性，這裡就會是 0 筆。",
};

const SLOT_KINDS: readonly EquipmentSlotKind[] = [1, 2, 3, 4, 5];

const SORT_LABELS: Record<string, string> = {
  bonus: "加值",
  probability: "機率",
  materials: "期望顆數",
};

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 sm:flex-nowrap">
      <span className="w-9 shrink-0 pt-1.5 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  note,
  zero,
}: {
  label: string;
  value: string;
  note?: string;
  zero?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card/70 px-3 py-2.5",
        // 0 筆是本頁最有價值的答案之一，用虛線＋朱砂讓它被看見，而不是淡出
        zero && "border-dashed border-primary/45 bg-primary/[0.06]",
      )}
    >
      <span className="block text-[0.7rem] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mt-1 block font-mono text-xl leading-none font-bold tabular-nums",
          zero && "text-primary",
        )}
      >
        {value}
        <span className="ml-1 font-sans text-[0.65rem] font-normal text-muted-foreground">
          筆
        </span>
      </span>
      {note && <span className="mt-1 block text-[0.65rem] text-primary/90">{note}</span>}
    </div>
  );
}

function StatCell({
  label,
  value,
  estimate,
  className,
}: {
  label: string;
  value: string;
  estimate?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card/50 px-3 py-2", className)}>
      <span className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
        {label}
        {estimate && (
          <Badge
            variant="outline"
            className="h-3.5 rounded px-1 text-[0.6rem] font-normal text-muted-foreground"
          >
            推估
          </Badge>
        )}
      </span>
      <span className="mt-1 block font-mono text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function GlossaryItem({
  icon: Icon,
  children,
}: {
  icon: typeof CircleAlertIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export default async function EnhanceFinderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = parseEnhancementSearchParams(params);

  // 保留使用者原本打的值，讓錯誤畫面看得出是哪個參數壞掉
  const rawOf = (key: string): string => {
    const v = params[key];
    if (v === undefined) return "";
    return Array.isArray(v) ? v.join(", ") : v;
  };

  const attribute = parsed.ok ? parsed.search.bonusType : DEFAULT_ENHANCEMENT_SEARCH.bonusType;
  const family: EnhancementFamily = parsed.ok
    ? parsed.search.family
    : DEFAULT_ENHANCEMENT_SEARCH.family;
  const slot = parsed.ok ? parsed.search.slot : DEFAULT_ENHANCEMENT_SEARCH.slot;
  const sort = parsed.ok ? parsed.sort : DEFAULT_ENHANCEMENT_SEARCH.sort;
  const attributeLabel = bonusLabel(attribute) ?? attribute;

  // 參數不合法時完全不碰 DB。家族統計一律以 family="all" 取得，
  // 這樣切到單一家族時「其他家族有幾筆」仍然是對的，且查詢數不變。
  const allResults: EnhancementResult[] = parsed.ok
    ? getEnhancementsByBonus({ bonusType: attribute, family: "all", slot })
    : [];

  const byFamily = new Map<ResultFamily, EnhancementResult[]>(
    FAMILY_ORDER.map((f) => [f, [] as EnhancementResult[]]),
  );
  for (const r of allResults) byFamily.get(r.family)!.push(r);

  const visible = family === "all" ? allResults : (byFamily.get(family) ?? []);
  const visibleFamilies = family === "all" ? FAMILY_GROUP_ORDER : [family as ResultFamily];

  const iconMap = getItemIconMap(collectCompoundItemIds(visible.map((r) => r.use)));

  const slotLabel = slot != null ? EQUIPMENT_SLOT_LABELS[slot] : null;
  /**
   * 0 筆的原因有兩種，說法不能混用：
   *   - 沒有槽位條件 → 這個家族真的加不到該屬性
   *   - 有槽位條件   → 可能只是這個槽位沒有，該家族在別的槽位仍有配方
   * 說錯會變成資料站在騙人。
   */
  const zeroReason = (label: string): string =>
    slotLabel == null
      ? `${label}加不到${attributeLabel}`
      : `${label}加不到${slotLabel}的${attributeLabel}`;

  // 摘要統計的範圍是「這個屬性（含槽位條件）的全部配方」，不隨家族篩選變動
  const bonusMin = Math.min(...allResults.map((r) => r.target.min));
  const bonusMax = Math.max(...allResults.map((r) => r.target.max));
  const probMin = Math.min(...allResults.map((r) => r.target.prob));
  const probMax = Math.max(...allResults.map((r) => r.target.prob));
  const expected = allResults
    .map((r) => r.expectedMaterials)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const roundOne = (n: number) => Math.round(n * 10) / 10;
  const availableSlots = new Set(
    allResults.map((r) => r.use.sideMaterials[0]?.id).filter((id): id is number => id != null),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ── 標題 ─────────────────────────────────────────────── */}
      <header className="relative border-b border-border/60 pb-5">
        <span
          aria-hidden
          className="absolute top-1 -left-4 hidden h-14 w-[3px] rounded-full bg-primary sm:block"
        />
        <h1 className="font-heading text-2xl leading-tight font-bold md:text-3xl">
          屬性反查
          <span className="ml-2 font-medium text-muted-foreground">強化配方</span>
        </h1>
        <div className="mt-3 max-w-[46ch] rounded-lg border border-dashed border-border/70 bg-card/60 px-3 py-2.5 text-[0.8rem] leading-relaxed text-muted-foreground">
          <b className="font-medium text-foreground">
            我要加物攻，該用哪顆真元？大概要幾顆才會成功？
          </b>
          <br />
          選一個想加的屬性，這裡把加得到它的配方全列出來，附上單次機率與毀裝標記。
        </div>
      </header>

      {/* ── 篩選 ─────────────────────────────────────────────── */}
      <form
        action="/tools/enhance"
        method="get"
        className="mt-5 space-y-2.5 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 sm:p-4"
      >
        <FilterRow label="屬性">
          <Select
            key={`attribute-${attribute}`}
            name="attribute"
            defaultValue={attribute}
            items={ENHANCEMENT_BONUS_TYPES.map((t) => ({
              value: t,
              label: bonusLabel(t) ?? t,
            }))}
          >
            <SelectTrigger
              size="default"
              aria-label="想加的屬性"
              className="h-10 w-full max-w-xs sm:w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENHANCEMENT_BONUS_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {bonusLabel(t) ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterRow>

        <FilterRow label="家族">
          <RadioGroup key={`family-${family}`} name="family" defaultValue={family}>
            <RadioOption value="all">全部</RadioOption>
            {FAMILY_GROUP_ORDER.map((f) => (
              <RadioOption key={f} value={f}>
                {FAMILY_LABELS[f]}
              </RadioOption>
            ))}
          </RadioGroup>
        </FilterRow>

        <FilterRow label="槽位">
          <RadioGroup
            key={`slot-${slot ?? "all"}`}
            name="slot"
            defaultValue={slot == null ? "all" : String(slot)}
          >
            <RadioOption value="all">全部</RadioOption>
            {SLOT_KINDS.map((s) => (
              <RadioOption key={s} value={String(s)}>
                {EQUIPMENT_SLOT_LABELS[s]}
              </RadioOption>
            ))}
          </RadioGroup>
        </FilterRow>

        <FilterRow label="排序">
          <RadioGroup key={`sort-${sort}`} name="sort" defaultValue={sort}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <RadioOption key={value} value={value}>
                {label}
              </RadioOption>
            ))}
          </RadioGroup>
        </FilterRow>

        <div className="flex justify-end pt-1">
          <Button type="submit" size="lg" className="h-10 px-5 text-sm font-bold">
            <SearchIcon aria-hidden />
            查詢
          </Button>
        </div>
      </form>

      {/* ── 參數錯誤 ─────────────────────────────────────────── */}
      {!parsed.ok && (
        <section
          role="alert"
          className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
        >
          <h2 className="flex items-center gap-2 text-sm font-medium text-destructive">
            <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
            網址參數有問題，這次沒有查詢
          </h2>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-destructive">
            {parsed.errors.map((e) => (
              <li key={e} className="flex items-start gap-1.5">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                {e}
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-destructive/25 pt-3 text-xs">
            {["attribute", "family", "slot", "sort"].map((key) => (
              <div key={key} className="contents">
                <dt className="font-mono text-muted-foreground">{key}</dt>
                <dd className="truncate font-mono text-foreground">
                  {rawOf(key) === "" ? (
                    <span className="font-sans text-muted-foreground italic">未提供</span>
                  ) : (
                    rawOf(key)
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            上面的篩選已經退回預設值。改好後按「查詢」就會重新產生一個乾淨的網址。
          </p>
        </section>
      )}

      {/* ── 摘要 ─────────────────────────────────────────────── */}
      {parsed.ok && allResults.length > 0 && (
        <section aria-label="查詢摘要" className="mt-6">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="font-heading text-base font-semibold">
              加{attributeLabel}的配方
            </h2>
            <span className="font-mono text-2xl leading-none font-bold text-primary tabular-nums">
              {allResults.length}
            </span>
            <span className="text-xs text-muted-foreground">
              筆
              {slot != null && ` · 只看${EQUIPMENT_SLOT_LABELS[slot]}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FAMILY_GROUP_ORDER.map((f) => {
              const n = byFamily.get(f)!.length;
              return (
                <SummaryCell
                  key={f}
                  label={FAMILY_LABELS[f]}
                  value={String(n)}
                  zero={n === 0}
                  note={n === 0 ? zeroReason(FAMILY_LABELS[f]) : undefined}
                />
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slot == null && (
              <div className="col-span-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 sm:col-span-4">
                <span className="block text-[0.7rem] text-muted-foreground">可用槽位</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SLOT_KINDS.map((s) => {
                    const has = availableSlots.has(s);
                    return (
                      <Badge
                        key={s}
                        variant="outline"
                        className={cn(
                          "h-5 px-2 text-[0.7rem] font-normal",
                          has
                            ? "border-chart-2/50 bg-chart-2/10 text-chart-2"
                            : "text-muted-foreground/60 line-through",
                        )}
                      >
                        {EQUIPMENT_SLOT_LABELS[s]}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <StatCell label="加值範圍" value={formatBonusRange(bonusMin, bonusMax)} />
            <StatCell
              label="機率範圍"
              value={
                probMin === probMax
                  ? formatProb(probMax)
                  : `${formatProb(probMin)} ~ ${formatProb(probMax)}`
              }
            />
            <StatCell
              label="期望顆數"
              estimate
              className="col-span-2"
              value={
                expected.length === 0
                  ? "查無"
                  : `${roundOne(Math.min(...expected))} ~ ${roundOne(Math.max(...expected))} 顆`
              }
            />
          </div>
        </section>
      )}

      {/* ── 全部 0 筆 ────────────────────────────────────────── */}
      {parsed.ok && allResults.length === 0 && (
        <section className="mt-6 flex items-start gap-3.5 rounded-xl border border-dashed border-primary/40 bg-primary/[0.05] px-4 py-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <SearchXIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold">
              沒有配方能加{slotLabel != null && `${slotLabel}的`}
              {attributeLabel}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              四個家族全部都是 0 筆。這是查完的結果，不是資料還沒收。
              {slotLabel != null && "換一個槽位，或把槽位切回「全部」再看一次。"}
            </p>
          </div>
        </section>
      )}

      {/* ── 結果分組 ─────────────────────────────────────────── */}
      {parsed.ok && allResults.length > 0 && (
        <div className="mt-8 space-y-8">
          {visibleFamilies.map((f) => {
            const rows = sortEnhancements(byFamily.get(f) ?? [], sort);
            return (
              <section key={f} aria-label={`${FAMILY_LABELS[f]}配方`}>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border/60 pb-2">
                  <h3 className="flex items-center gap-2 font-heading text-[0.95rem] font-semibold">
                    {f === "stone" && rows.length === 0 ? (
                      <BanIcon className="size-4 text-primary" aria-hidden />
                    ) : (
                      <LayersIcon className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    {FAMILY_LABELS[f]}
                  </h3>
                  <Badge
                    variant={rows.length === 0 ? "outline" : "secondary"}
                    className={cn(
                      "h-5 px-2 font-mono text-[0.7rem] font-medium tabular-nums",
                      rows.length === 0 && "border-primary/40 text-primary",
                    )}
                  >
                    {rows.length} 筆
                  </Badge>
                  <span className="ml-auto text-[0.7rem] text-muted-foreground">
                    依{SORT_LABELS[sort]}排序
                  </span>
                </div>

                <p className="mt-2 flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                  <CircleDotIcon className="mt-0.5 size-3 shrink-0 opacity-60" aria-hidden />
                  {FAMILY_NOTES[f]}
                </p>

                {rows.length === 0 ? (
                  <div className="mt-3 flex items-start gap-3.5 rounded-lg border border-dashed border-primary/40 bg-primary/[0.05] px-4 py-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <BanIcon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-heading text-sm font-medium">
                        {zeroReason(FAMILY_LABELS[f])}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        用{attributeLabel}
                        {slotLabel != null && `加上${slotLabel}`}
                        去找，{FAMILY_LABELS[f]}家族一筆配方都沒有。這是查完的結果，不是資料還沒收。
                        {/* 有槽位條件時不能斷言「這家族加不到」— 它在別的槽位可能有 */}
                        {slotLabel != null &&
                          `把槽位切回「全部」可以確認 ${FAMILY_LABELS[f]} 在其他槽位有沒有。`}
                        {/* 只篩單一家族時，其他家族的結果並沒有渲染出來，不能叫玩家「看上面」 */}
                        {family === "all"
                          ? `想加${attributeLabel}，看上面其他家族的結果。`
                          : `其他家族還有 ${allResults.length} 筆，把家族切回「全部」就看得到。`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
                    {rows.map((r) => (
                      <EnhancementCard key={r.use.id} result={r} iconMap={iconMap} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── 欄位與方法 ───────────────────────────────────────── */}
      <section
        aria-labelledby="method-heading"
        className="mt-10 border-t border-border/60 pt-5"
      >
        <h2
          id="method-heading"
          className="mb-3 flex items-center gap-2 font-heading text-sm font-medium text-muted-foreground"
        >
          <ScrollTextIcon className="size-4" aria-hidden />
          欄位怎麼看
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-6">
          <GlossaryItem icon={FlaskConicalIcon}>
            <b className="font-medium text-foreground">期望顆數（推估）</b>
            {" ＝ 材料顆數 ÷ 單次機率，是本站依機率推導出來的，"}
            <b className="font-medium text-foreground">不是遊戲原始資料</b>
            。它是統計上的平均值，
            <b className="font-medium text-foreground">不代表這個顆數之內保證會成功</b>
            ；50% 的配方期望 2 顆，連續失敗五次也完全正常。
          </GlossaryItem>
          <GlossaryItem icon={CircleAlertIcon}>
            <b className="font-medium text-foreground">機率</b>
            　是單次嘗試出現該屬性的實際機率。同一條配方把同一個屬性拆成多個級距時，這裡顯示的是各級距相加的總和，展開「分 N 段」可以看到每一段各佔多少。
          </GlossaryItem>
          <GlossaryItem icon={TriangleAlertIcon}>
            <b className="font-medium text-foreground">期望顆數沒有算進去的東西</b>
            　毀裝造成的裝備損失、材料本身的取得難度與市場價值，都不在這個數字裡。標「會毀裝」的配方，失敗時裝備會消失。
          </GlossaryItem>
          <GlossaryItem icon={CircleAlertIcon}>
            <b className="font-medium text-foreground">「查無」不等於 0</b>
            　「查無」是資料檔裡這一欄是空的，不知道值是多少；「0」才是真的為零。金錢與失敗回收都適用。
          </GlossaryItem>
          <GlossaryItem icon={CircleAlertIcon}>
            <b className="font-medium text-foreground">等級</b>
            　只有部分配方有。魂珠、魂石那一欄在資料檔裡存的是編碼不是等級，所以不顯示，也不猜。
          </GlossaryItem>
          <GlossaryItem icon={CircleAlertIcon}>
            <b className="font-medium text-foreground">資料來源</b>
            　全部取自遊戲資料檔，非官方公布數值，也未經實機驗證。沒有的欄位就寫「查無」，不會替它補一個數字。
          </GlossaryItem>
        </div>
      </section>
    </div>
  );
}
