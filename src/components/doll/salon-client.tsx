"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  KeyboardIcon,
  LinkIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import type {
  DollCatalogItem,
  DollEquipSlot,
  DollFrame,
  DollGender,
  DollHead,
  DollRule,
} from "@/lib/queries/doll";
import { DollPreview, buildDollLayers } from "@/components/doll/doll-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SalonSelection {
  gender: DollGender;
  head: number;
  /** 道具 id；null = 沒穿 */
  items: Record<DollEquipSlot, number | null>;
}

// doll.ts 是 server-only，這裡不能 import 它的常數，只好在 client 再列一次
const SLOTS: { slot: DollEquipSlot; label: string }[] = [
  { slot: "cap", label: "帽子" },
  { slot: "body", label: "衣服" },
  { slot: "foot", label: "褲子" },
  { slot: "wing", label: "背飾" },
];

/** 順時針：正面 → 右前 → … → 左前。←/→ 就是沿這個順序轉。 */
const DIR_ORDER = [7, 8, 1, 2, 3, 4, 5, 6];
const DIR_NAME: Record<number, string> = {
  7: "正面",
  8: "右前",
  1: "右側",
  2: "右後",
  3: "背面",
  4: "左後",
  5: "左側",
  6: "左前",
};

const PICKER_LIMIT = 100;

function salonHref(sel: SalonSelection, dir: number, head: number | "" = sel.head) {
  const p = new URLSearchParams({ g: sel.gender, head: String(head) });
  for (const { slot } of SLOTS) {
    const id = sel.items[slot];
    if (id != null) p.set(slot, String(id));
  }
  p.set("dir", String(dir));
  return `/tools/salon?${p.toString()}`;
}

interface Props {
  selection: SalonSelection;
  initialDir: number;
  rules: DollRule[];
  frames: DollFrame[];
  heads: DollHead[];
  headThumbs: DollFrame[];
  catalog: Record<DollEquipSlot, DollCatalogItem[]>;
}

export function SalonClient({
  selection,
  initialDir,
  rules,
  frames,
  heads,
  headThumbs,
  catalog,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dir, setDir] = useState(initialDir);
  const [copied, setCopied] = useState(false);

  const navigate = (href: string) =>
    startTransition(() => router.replace(href, { scroll: false }));

  const update = (slot: DollEquipSlot, id: number | null) =>
    navigate(salonHref({ ...selection, items: { ...selection.items, [slot]: id } }, dir));

  // 轉方向不需要重查，只改網址讓分享連結帶得到
  const turnTo = (d: number) => {
    setDir(d);
    window.history.replaceState(null, "", salonHref(selection, d));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable], [role=listbox]")) return;
      e.preventDefault();
      const i = DIR_ORDER.indexOf(dir);
      turnTo(DIR_ORDER[(i + (e.key === "ArrowRight" ? 1 : -1) + 8) % 8]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const share = async () => {
    const url = window.location.origin + salonHref(selection, dir);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("複製以下連結", url);
    }
  };

  const reset = () => {
    setDir(7);
    navigate(`/tools/salon?g=${selection.gender}`);
  };

  const layerCount = buildDollLayers(frames, rules, dir).length;
  const selectedOf = (slot: DollEquipSlot) =>
    catalog[slot].find((it) => it.itemId === selection.items[slot]) ?? null;
  const headLabel = heads.find((h) => h.sequence === selection.head)?.label ?? "—";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[352px_minmax(0,1fr)]">
      {/* ── 配裝 ─────────────────────────────────────────── */}
      <Card className="gap-0 py-0">
        <PanelHeader title="配裝" hint="共 5 個部位" />
        <CardContent className="space-y-4 py-4">
          <div>
            <FieldLabel>性別</FieldLabel>
            <ToggleGroup
              aria-label="性別"
              value={[selection.gender]}
              onValueChange={(v) => {
                const g = v[0] as DollGender | undefined;
                if (!g || g === selection.gender) return;
                // 頭型清空交給伺服器挑第一個；對方目錄沒有的道具會被伺服器丟掉
                navigate(salonHref({ ...selection, gender: g }, dir, ""));
              }}
            >
              <ToggleGroupItem value="m" className="px-4">
                男
              </ToggleGroupItem>
              <ToggleGroupItem value="f" className="px-4">
                女
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div>
            <FieldLabel>頭型</FieldLabel>
            <ToggleGroup
              aria-label="頭型"
              value={[String(selection.head)]}
              onValueChange={(v) => {
                if (v[0]) navigate(salonHref(selection, dir, Number(v[0])));
              }}
              className="grid w-full grid-cols-3 gap-2 border-0 bg-transparent p-0 sm:grid-cols-4 lg:grid-cols-3"
            >
              {heads.map((h) => {
                const thumb = headThumbs.find((f) => f.sequence === h.sequence);
                return (
                  <ToggleGroupItem
                    key={h.sequence}
                    value={String(h.sequence)}
                    className="group relative h-auto flex-col gap-1 border-border bg-background px-0 pt-2 pb-1.5 text-muted-foreground hover:bg-muted/50 data-pressed:border-primary data-pressed:bg-primary/[0.07] data-pressed:text-foreground data-pressed:shadow-none"
                  >
                    <CheckIcon
                      aria-hidden
                      className="absolute top-1 right-1 hidden size-3.5! text-primary group-data-pressed:block"
                    />
                    <span className="grid h-[46px] w-11 place-items-center">
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink
                        <img
                          src={thumb.url}
                          alt=""
                          width={thumb.width}
                          height={thumb.height}
                          className="h-auto max-w-full [image-rendering:pixelated]"
                        />
                      )}
                    </span>
                    <span className="text-[11.5px] font-normal group-data-pressed:font-medium">
                      {h.label}
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          <div>
            <FieldLabel>部位</FieldLabel>
            <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
              {SLOTS.map(({ slot, label }) => {
                const selected = selectedOf(slot);
                return (
                  <div key={slot} className="contents">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <SlotPicker
                      label={label}
                      items={catalog[slot]}
                      selected={selected}
                      onChange={(id) => update(slot, id)}
                    />
                    {selected && !selected.hasImage && (
                      <p className="col-start-2 -mt-1 flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
                        此裝備無外觀資料
                      </p>
                    )}
                  </div>
                );
              })}
              <span className="text-sm text-muted-foreground">武器</span>
              <Button variant="outline" disabled className="justify-between px-2.5 font-normal">
                即將推出
                <ChevronDownIcon className="text-muted-foreground" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={share}>
              {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
              {copied ? "已複製連結" : "複製分享連結"}
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcwIcon aria-hidden />
              重設
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 預覽（手機在最上面） ─────────────────────────── */}
      <div className="-order-1 flex min-w-0 flex-col gap-5 lg:order-none">
        <Card className="gap-0 py-0">
          <PanelHeader
            title="角色預覽"
            hint={
              <>
                <span className="lg:hidden">3x</span>
                <span className="hidden lg:inline">4x</span> · 像素原圖
              </>
            }
          />
          <div
            className="relative grid min-h-[392px] place-items-center overflow-hidden lg:min-h-[492px]"
            style={{
              background: [
                "linear-gradient(to right, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px) 0 0 / 28px 28px",
                "linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px) 0 0 / 28px 28px",
                "radial-gradient(ellipse 70% 60% at 50% 62%, color-mix(in oklab, var(--card) 92%, transparent), transparent 75%)",
                "var(--background)",
              ].join(", "),
            }}
          >
            <DollPreview
              frames={frames}
              rules={rules}
              dir={dir}
              className={cn(
                "transition-opacity [--doll-scale:3] lg:[--doll-scale:4]",
                pending && "opacity-50",
              )}
            />
            {layerCount === 0 && (
              <p className="absolute inset-x-0 bottom-5 text-center text-xs text-muted-foreground">
                沒有可顯示的外觀
              </p>
            )}
            <DirectionCompass dir={dir} onChange={turnTo} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <KeyboardIcon className="size-3.5" aria-hidden />按
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              旋轉角色
            </span>
            <span>{layerCount} 層外觀</span>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <PanelHeader title="目前穿著" hint="點名稱前往道具頁" />
          <CardContent className="py-3">
            <dl className="grid gap-x-6 sm:grid-cols-2 [&>div]:border-b [&>div]:border-dashed [&>div]:border-border/70 [&>div:last-child]:border-b-0 sm:[&>div:nth-last-child(2)]:border-b-0">
              <WornRow label="頭型">{headLabel}</WornRow>
              {SLOTS.map(({ slot, label }) => {
                const it = selectedOf(slot);
                return (
                  <WornRow
                    key={slot}
                    label={label}
                    flag={it && !it.hasImage ? "無外觀資料" : undefined}
                  >
                    {it ? (
                      <Link
                        href={`/items/${it.itemId}`}
                        className="border-b border-primary/45 hover:text-primary"
                      >
                        {it.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">未配戴</span>
                    )}
                  </WornRow>
                );
              })}
              <WornRow label="武器">
                <span className="text-muted-foreground">即將推出</span>
              </WornRow>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PanelHeader({ title, hint }: { title: string; hint: React.ReactNode }) {
  return (
    <CardHeader className="flex items-center justify-between gap-3 border-b border-border/60 py-3 [.border-b]:pb-3">
      <CardTitle className="font-semibold">{title}</CardTitle>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </CardHeader>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</span>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-b-2 border-border bg-background px-1.5 font-sans text-[11px]">
      {children}
    </kbd>
  );
}

function WornRow({
  label,
  flag,
  children,
}: {
  label: string;
  flag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-2">
      <dt className="w-11 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-sm">{children}</dd>
      {flag && (
        <Badge variant="secondary" className="ml-auto shrink-0 font-normal text-muted-foreground">
          {flag}
        </Badge>
      )}
    </div>
  );
}

function SlotPicker({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: DollCatalogItem[];
  selected: DollCatalogItem | null;
  onChange: (itemId: number | null) => void;
}) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <Combobox
        items={items}
        value={selected}
        onValueChange={(it: DollCatalogItem | null) => {
          if (it) onChange(it.itemId);
        }}
        itemToStringLabel={(it: DollCatalogItem) => it.name}
        isItemEqualToValue={(a: DollCatalogItem, b: DollCatalogItem) => a.itemId === b.itemId}
        filter={(it: DollCatalogItem, q: string) => {
          const kw = q.trim();
          return !kw || it.name.includes(kw) || String(it.itemId).includes(kw);
        }}
        // ponytail: 一次只畫前 100 筆，目錄上千筆時靠搜尋縮小；真的要全捲再上虛擬清單
        limit={PICKER_LIMIT}
      >
        <ComboboxTrigger
          aria-label={`選擇${label}`}
          render={<Button variant="outline" className="min-w-0 flex-1 justify-between px-2.5 font-normal" />}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.name ?? "未選擇"}
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="min-w-64">
          <ComboboxInput showTrigger={false} placeholder={`搜尋${label}名稱或 ID…`} aria-label={`搜尋${label}`} />
          <ComboboxEmpty>找不到符合的道具</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(it: DollCatalogItem) => (
                <ComboboxItem key={it.itemId} value={it}>
                  <span className="flex-1 truncate">{it.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {!it.hasImage && "無外觀 · "}#{it.itemId}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {selected && (
        <Button
          variant="outline"
          size="icon"
          aria-label={`清除${label}`}
          className="text-muted-foreground"
          onClick={() => onChange(null)}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}

function DirectionCompass({ dir, onChange }: { dir: number; onChange: (d: number) => void }) {
  return (
    <ToggleGroup
      aria-label="角色方向"
      value={[String(dir)]}
      onValueChange={(v) => {
        if (v[0]) onChange(Number(v[0]));
      }}
      className="absolute right-3 bottom-3 block h-[126px] w-[126px] rounded-full border-border/70 bg-card/80 p-0 shadow-sm backdrop-blur-sm lg:right-5 lg:bottom-5 lg:h-[150px] lg:w-[150px]"
    >
      {DIR_ORDER.map((d, i) => {
        const a = ((-90 + i * 45) * Math.PI) / 180;
        return (
          <ToggleGroupItem
            key={d}
            value={String(d)}
            aria-label={`方向 ${DIR_NAME[d]}`}
            title={DIR_NAME[d]}
            className="absolute h-6.5 w-6.5 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 text-[11px] tabular-nums hover:bg-muted/60 data-pressed:bg-primary data-pressed:text-primary-foreground"
            style={{ left: `${50 + Math.cos(a) * 38}%`, top: `${50 + Math.sin(a) * 38}%` }}
          >
            {d}
          </ToggleGroupItem>
        );
      })}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <b className="block font-heading text-[15px] leading-tight text-foreground">
          {DIR_NAME[dir]}
        </b>
        <span className="text-[10px] tracking-wider text-muted-foreground">DIR {dir}</span>
      </div>
    </ToggleGroup>
  );
}
