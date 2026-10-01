"use client";

import Link from "next/link";
import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CrownIcon,
  FeatherIcon,
  FootprintsIcon,
  GemIcon,
  KeyboardIcon,
  LinkIcon,
  PackageIcon,
  RabbitIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldIcon,
  ShirtIcon,
  SparklesIcon,
  SwordIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import type {
  DollFrame,
  DollGender,
  DollHead,
  DollHairColor,
  DollLook,
  DollPart,
  DollRule,
  DollSlot,
  DollSlotInfo,
} from "@/lib/queries/doll";
import { DollPreview, buildDollLayers } from "@/components/doll/doll-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  createTooltipHandle,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** 每個部位穿了哪一格外觀；itemId 是網址上代表這格的道具 */
export type SalonWorn = Partial<Record<DollSlot, { itemId: number; look: DollLook }>>;
type Hand = "r" | "l";
type Filter = "all" | "normal" | "extra";

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

const SLOT_ICON: Partial<Record<DollSlot, LucideIcon>> = {
  cap: CrownIcon,
  body: ShirtIcon,
  foot: FootprintsIcon,
  horse: RabbitIcon,
  wing: FeatherIcon,
  ornament1: GemIcon,
  ornament2: SparklesIcon,
  right: SwordIcon,
  left: ShieldIcon,
};
const slotIcon = (slot: DollSlot, className: string) =>
  createElement(SLOT_ICON[slot] ?? PackageIcon, { className, "aria-hidden": true });
const WEAPON_SLOTS: DollSlot[] = ["right", "left"];

const isTwoHand = (look: DollLook) => look.layers.some((p) => p.slot === "left");
/** 右手武器這時候有沒有佔用左手（雙手武器，或單手武器改拿左手） */
const weaponUsesLeft = (look: DollLook | undefined, hand: Hand) =>
  !!look && (isTwoHand(look) || (hand === "l" && !!look.offhandLayers));
/** 「不穿」那格的文字：衣服、褲子空著其實是穿初心者外觀 */
const noneLabel = (label: string, hasBase: boolean) =>
  hasBase ? `${label}：預設外觀（初心者）` : `不穿${label}`;
const frameKey = (f: DollFrame) => `${f.slot}:${f.sequence}:${f.action}:${f.dir}:${f.color}`;

interface TipPayload {
  label: string;
  look: DollLook | null;
  hasBase?: boolean;
}
const tip = createTooltipHandle<TipPayload>();

interface Props {
  gender: DollGender;
  slots: DollSlotInfo[];
  counts: Record<string, number>;
  heads: DollHead[];
  hairColors: DollHairColor[];
  initialHair: number;
  rules: DollRule[];
  initialFrames: DollFrame[];
  initialTab: DollSlot;
  initialLooks: DollLook[];
  initialWorn: SalonWorn;
  defaultWorn: SalonWorn;
  initialHead: number;
  defaultHead: number;
  initialDir: number;
  initialHand: Hand;
  /** 衣服／褲子沒穿時畫的初心者外觀 */
  base: Partial<Record<DollSlot, DollPart>>;
}

export function SalonClient(props: Props) {
  const { gender, slots, counts, heads, rules, base } = props;
  const router = useRouter();

  const [worn, setWorn] = useState<SalonWorn>(props.initialWorn);
  const [head, setHead] = useState(props.initialHead);
  const [hair, setHair] = useState(props.initialHair);
  const [dir, setDir] = useState(props.initialDir);
  const [hand, setHand] = useState<Hand>(props.initialHand);
  const [tab, setTab] = useState<DollSlot>(props.initialTab);
  const [looksBySlot, setLooksBySlot] = useState<Partial<Record<DollSlot, DollLook[]>>>({
    [props.initialTab]: props.initialLooks,
  });
  const [failed, setFailed] = useState<Partial<Record<DollSlot, boolean>>>({});
  const [frames, setFrames] = useState(props.initialFrames);
  const [copied, setCopied] = useState(false);
  const inflight = useRef(new Set<DollSlot>());

  const slotInfo = (slot: DollSlot) => slots.find((s) => s.slot === slot);
  const labelOf = (slot: DollSlot) => slotInfo(slot)?.label ?? slot;

  // ── 分頁資料：每個部位只抓一次，存在記憶體 ──
  useEffect(() => {
    if (looksBySlot[tab] || inflight.current.has(tab)) return;
    inflight.current.add(tab);
    // ponytail: v= 讓瀏覽器丟掉舊格式的快取（API 有 max-age=3600），回應格式改了就 +1
    fetch(`/api/doll/looks?g=${gender}&slot=${tab}&v=4`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { looks: DollLook[]; frames: DollFrame[] }) => {
        setLooksBySlot((prev) => ({ ...prev, [tab]: data.looks }));
        setFrames((prev) => {
          const have = new Set(prev.map(frameKey));
          return [...prev, ...data.frames.filter((f) => !have.has(frameKey(f)))];
        });
      })
      .catch(() => setFailed((prev) => ({ ...prev, [tab]: true })))
      .finally(() => inflight.current.delete(tab));
  }, [tab, gender, looksBySlot]);

  // ── 要畫的圖層 ──
  const hidden = new Set(
    slots.filter((s) => s.replaces && worn[s.slot]).map((s) => s.replaces as DollSlot),
  );
  const parts: DollPart[] = [{ slot: "head", sequence: head }];
  for (const s of slots) {
    const w = worn[s.slot];
    if (!w) {
      // 衣服、褲子空著就畫初心者外觀，角色不會缺手缺腳
      if (base[s.slot]) parts.push(base[s.slot]!);
      continue;
    }
    const useOffhand = s.slot === "right" && hand === "l" && w.look.offhandLayers;
    parts.push(...(useOffhand ? w.look.offhandLayers! : w.look.layers));
  }
  const drawParts = parts.filter((p) => !hidden.has(p.slot));
  const layerCount = buildDollLayers(frames, rules, dir, drawParts, hair).length;
  const missing = slots.filter((s) => worn[s.slot] && !worn[s.slot]!.look.hasImage);

  // ── 網址：換裝、轉向都只改網址，不打伺服器 ──
  const href = useMemo(() => {
    const p = new URLSearchParams({ g: gender, head: String(head) });
    if (hair !== 0) p.set("hair", String(hair));
    for (const s of slots) {
      const w = worn[s.slot];
      if (w) p.set(s.slot, String(w.itemId));
    }
    if (worn.right?.look.offhandLayers && hand === "l") p.set("hand", "l");
    p.set("dir", String(dir));
    return `/tools/salon?${p.toString()}`;
  }, [gender, head, hair, slots, worn, hand, dir]);

  useEffect(() => {
    window.history.replaceState(null, "", href);
  }, [href]);

  // ── ←/→ 轉角色：焦點在格子、分頁、切換鈕或輸入框裡時交給它們自己處理 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest(
          "input, textarea, select, [contenteditable], [role=listbox], [role=tablist], [role=group], [role=radiogroup]",
        )
      )
        return;
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setDir((cur) => DIR_ORDER[(DIR_ORDER.indexOf(cur) + step + 8) % 8]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── 換裝：點一下穿上，再點一次脫下；武器跟左手互相讓位 ──
  const wear = (slot: DollSlot, look: DollLook | null) => {
    const next: SalonWorn = { ...worn };
    let nextHand = hand;
    if (!look || worn[slot]?.look.key === look.key) delete next[slot];
    else next[slot] = { itemId: look.items[0].itemId, look };

    if (slot === "right" && next.right && weaponUsesLeft(next.right.look, hand)) delete next.left;
    if (slot === "left" && next.left && next.right && weaponUsesLeft(next.right.look, hand)) {
      if (isTwoHand(next.right.look)) delete next.right;
      else nextHand = "r";
    }
    setWorn(next);
    setHand(nextHand);
  };

  const chooseHand = (h: Hand) => {
    setHand(h);
    if (h === "l" && worn.left) {
      const next = { ...worn };
      delete next.left;
      setWorn(next);
    }
  };

  const share = async () => {
    const url = window.location.origin + href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("複製以下連結", url);
    }
  };

  const reset = () => {
    setWorn(props.defaultWorn);
    setHead(props.defaultHead);
    setHair(0);
    setHand("r");
    setDir(7);
  };

  const switchGender = (g: DollGender) => {
    if (g === gender) return;
    // 頭型留空交給伺服器挑第一個；對方沒有的道具伺服器會丟掉
    const p = new URLSearchParams(href.split("?")[1]);
    p.set("g", g);
    p.set("head", "");
    p.delete("hair");
    router.replace(`/tools/salon?${p.toString()}`, { scroll: false });
  };

  // 分頁上的提醒：被別的部位蓋掉、跟武器衝突、武器位置還沒校正好
  const tabNotes = (slot: DollSlot): string[] => {
    const notes: string[] = [];
    const replacer = slots.find((s) => s.replaces === slot && worn[s.slot]);
    if (replacer) notes.push(`穿著${replacer.label}時不顯示${labelOf(slot)}。`);
    if (slot === "left" && weaponUsesLeft(worn.right?.look, hand)) {
      notes.push(
        isTwoHand(worn.right!.look)
          ? `目前的雙手武器會佔用左手，換上左手裝備會卸下${labelOf("right")}。`
          : `武器目前拿在左手，換上左手裝備會把武器換回右手。`,
      );
    }
    if (WEAPON_SLOTS.includes(slot)) notes.push("武器位置仍在校正，可能有偏差。");
    return notes;
  };

  const headThumbs = frames.filter((f) => f.slot === "head" && f.dir === 7 && f.color === 0);
  const hairOptions = props.hairColors.filter((color) => color.sequence === head);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_452px] lg:gap-5">
      {/* 桌機：左欄整塊黏住；手機：只有舞台黏在上方，穿著清單排到最後 */}
      <div className="contents lg:sticky lg:top-18 lg:flex lg:flex-col lg:gap-4">
        <div className="sticky top-14 z-30 -mx-4 bg-background px-4 pt-2 pb-1 lg:static lg:m-0 lg:p-0">
          <Card className="gap-0 py-0">
            <PanelHeader
              className="hidden lg:flex"
              title="角色預覽"
              hint={`${layerCount} 層 · 像素原圖`}
            />
            <div
              className="relative grid max-h-[46svh] min-h-[236px] place-items-center overflow-hidden sm:max-h-[60svh] sm:min-h-[330px] lg:max-h-[min(720px,calc(100svh-180px))] lg:min-h-[480px]"
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
                parts={drawParts}
                hairColor={hair}
                className="[--doll-scale:2] sm:[--doll-scale:3] lg:[--doll-scale:4]"
              />
              {missing.length > 0 && (
                <p className="absolute top-2.5 left-3 flex items-center gap-1.5 rounded-md bg-card/85 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                  <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
                  {missing.map((s) => s.label).join("、")}：此裝備無外觀資料
                </p>
              )}
              <DirectionCompass dir={dir} onChange={setDir} />
            </div>
          </Card>
        </div>

        <Card className="gap-0 py-0 lg:-mt-4 lg:rounded-t-none">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">性別</span>
            <ToggleGroup
              aria-label="性別"
              value={[gender]}
              onValueChange={(v) => v[0] && switchGender(v[0] as DollGender)}
            >
              <ToggleGroupItem value="m" size="sm">
                男
              </ToggleGroupItem>
              <ToggleGroupItem value="f" size="sm">
                女
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="text-xs text-muted-foreground">頭型</span>
            <ToggleGroup
              aria-label="頭型"
              value={[String(head)]}
              onValueChange={(v) => v[0] && setHead(Number(v[0]))}
              className="flex max-w-full min-w-0 flex-1 gap-1 overflow-x-auto border-0 bg-transparent p-0.5"
            >
              {heads.map((h) => {
                const thumb = headThumbs.find((f) => f.sequence === h.sequence);
                return (
                  <ToggleGroupItem
                    key={h.sequence}
                    value={String(h.sequence)}
                    aria-label={h.label}
                    title={h.label}
                    className="h-[42px] w-10 shrink-0 overflow-hidden border-border bg-background p-0 hover:bg-muted/55 data-pressed:border-primary data-pressed:bg-primary/[0.08] data-pressed:shadow-none"
                  >
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink
                      <img
                        src={thumb.url}
                        alt=""
                        width={thumb.width}
                        height={thumb.height}
                        loading="lazy"
                        className="h-auto max-h-9 max-w-[34px] [image-rendering:pixelated]"
                      />
                    )}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
          {hairOptions.length > 0 && (
            <HairSwatches
              options={hairOptions}
              frames={frames.filter((f) => f.slot === "head" && f.sequence === head && f.dir === 7)}
              value={hair}
              onChange={setHair}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <Button onClick={share}>
              {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
              {copied ? "已複製連結" : "複製分享連結"}
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcwIcon aria-hidden />
              重設
            </Button>
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <KeyboardIcon className="size-3.5" aria-hidden />
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              旋轉
            </span>
          </div>
        </Card>

        <Card className="order-last gap-0 py-0 lg:order-none">
          <PanelHeader title="目前穿著" hint="展開可看共用此外觀的道具" />
          <CardContent className="py-1.5">
            <div className="flex flex-col [&>*]:border-b [&>*]:border-dashed [&>*]:border-border/70 [&>*:last-child]:border-b-0">
              <WornLine label="頭型">
                <span className="truncate">
                  {heads.find((h) => h.sequence === head)?.label ?? "—"}
                </span>
              </WornLine>
              {slots.map((s) => {
                const w = worn[s.slot];
                if (!w) {
                  return (
                    <WornLine key={s.slot} label={s.label}>
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {base[s.slot] ? "預設外觀（初心者）" : "未配戴"}
                      </span>
                      {base[s.slot] && hidden.has(s.slot) && (
                        <Badge variant="secondary" className="font-normal text-muted-foreground">
                          不顯示
                        </Badge>
                      )}
                    </WornLine>
                  );
                }
                const flags = [
                  !w.look.hasImage && "無外觀資料",
                  hidden.has(s.slot) && "不顯示",
                  s.slot === "right" && hand === "l" && w.look.offhandLayers && "拿在左手",
                  s.slot === "right" && isTwoHand(w.look) && "雙手",
                ].filter(Boolean) as string[];
                return <WornGroup key={s.slot} label={s.label} look={w.look} flags={flags} />;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 外觀選擇 ─────────────────────────────────────── */}
      <Card className="gap-0 py-0">
        <PanelHeader title="外觀選擇" hint={labelOf(tab)} />
        <Tabs value={tab} onValueChange={(v) => setTab(v as DollSlot)} className="gap-0">
          <TabsList className="mx-4 mt-3.5 grid h-auto w-auto grid-cols-5 gap-[3px] p-1 group-data-horizontal/tabs:h-auto">
            {slots.map((s) => (
              <TabsTrigger
                key={s.slot}
                value={s.slot}
                className="group/tab h-11 min-w-0 flex-col gap-0 leading-tight"
              >
                <span className="text-[13px]">{s.label}</span>
                <span className="text-[10.5px] font-normal text-muted-foreground tabular-nums group-data-active/tab:text-primary">
                  {counts[s.slot] ?? 0} 種
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={tab}>
            <LookPicker
              key={tab}
              slot={tab}
              label={labelOf(tab)}
              hasBase={!!base[tab]}
              looks={looksBySlot[tab]}
              failed={!!failed[tab]}
              selectedKey={worn[tab]?.look.key ?? null}
              notes={tabNotes(tab)}
              onWear={(look) => wear(tab, look)}
              handSwitch={
                tab === "right" && worn.right?.look.offhandLayers ? (
                  <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    武器拿在
                    <ToggleGroup
                      aria-label="武器拿在哪一手"
                      value={[hand]}
                      onValueChange={(v) => v[0] && chooseHand(v[0] as Hand)}
                    >
                      <ToggleGroupItem value="r" size="sm">
                        右手
                      </ToggleGroupItem>
                      <ToggleGroupItem value="l" size="sm">
                        左手
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                ) : null
              }
            />
          </TabsContent>
        </Tabs>
      </Card>

      <Tooltip handle={tip}>
        {({ payload: raw }) => {
          const payload = raw as TipPayload | undefined;
          return payload ? (
            <TooltipContent className="max-w-60 leading-snug">
              {payload.look ? (
                <>
                  {payload.look.items[0]?.name ?? "未命名外觀"}
                  {payload.look.items.length > 1 && (
                    <span className="block text-[11px] opacity-70">
                      等 {payload.look.items.length} 件道具共用此外觀
                    </span>
                  )}
                  {!payload.look.hasImage && (
                    <span className="block text-[11px] opacity-70">此裝備無外觀資料</span>
                  )}
                </>
              ) : (
                noneLabel(payload.label, !!payload.hasBase)
              )}
            </TooltipContent>
          ) : null;
        }}
      </Tooltip>
    </div>
  );
}

function LookPicker({
  slot,
  label,
  hasBase,
  looks,
  failed,
  selectedKey,
  notes,
  onWear,
  handSwitch,
}: {
  slot: DollSlot;
  label: string;
  hasBase: boolean;
  looks: DollLook[] | undefined;
  failed: boolean;
  selectedKey: string | null;
  notes: string[];
  onWear: (look: DollLook | null) => void;
  handSwitch: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [focus, setFocus] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const kw = q.trim().toLowerCase();
  const visible = (looks ?? []).filter((look) => {
    const extra = look.items.some((i) => i.isExtra);
    if (filter === "extra" && !extra) return false;
    if (filter === "normal" && extra) return false;
    return (
      !kw ||
      look.items.some((i) => i.name.toLowerCase().includes(kw) || String(i.itemId).includes(kw))
    );
  });
  const cellCount = visible.length + 1;
  const focusAt = Math.min(focus, cellCount - 1);

  // 方向鍵在格子間移動（roving tabindex）；欄數直接量畫面上第一列有幾格
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const cells = [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-cell]") ?? [])];
    const i = cells.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const top = cells[0].offsetTop;
    const firstWrap = cells.findIndex((c) => c.offsetTop !== top);
    const cols = firstWrap > 0 ? firstWrap : cells.length;
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: cols,
      ArrowUp: -cols,
      Home: -i,
      End: cells.length,
    };
    if (!(e.key in steps)) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(cells.length - 1, i + steps[e.key]));
    setFocus(j);
    cells[j].focus();
  };

  const cellClass =
    "relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-background p-[3px] transition-colors outline-none hover:border-foreground/25 hover:bg-muted/55 focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-2 aria-selected:border-primary aria-selected:bg-primary/[0.08] aria-selected:p-[2px]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2.5">
        <InputGroup className="h-8 min-w-40 flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setFocus(0);
            }}
            placeholder="搜尋道具名稱或 ID…"
            aria-label={`搜尋${label}`}
          />
          {q && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="清除搜尋" onClick={() => setQ("")}>
                <XIcon aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <ToggleGroup
          aria-label="外觀類別"
          value={[filter]}
          onValueChange={(v) => {
            if (!v[0]) return;
            setFilter(v[0] as Filter);
            setFocus(0);
          }}
        >
          <ToggleGroupItem value="all" size="sm">
            全部
          </ToggleGroupItem>
          <ToggleGroupItem value="normal" size="sm">
            一般
          </ToggleGroupItem>
          <ToggleGroupItem value="extra" size="sm">
            時裝
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {notes.map((n) => (
        <p
          key={n}
          className="mx-4 mb-2 flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
        >
          <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          {n}
        </p>
      ))}
      {handSwitch}

      <p className="px-4 pb-2 text-xs text-muted-foreground tabular-nums">
        {failed
          ? "外觀資料載入失敗，請重新整理頁面。"
          : !looks
            ? "載入中…"
            : visible.length === looks.length
              ? `共 ${looks.length} 種外觀`
              : `符合 ${visible.length} 種外觀，共 ${looks.length} 種`}
      </p>

      <div
        ref={gridRef}
        role="listbox"
        aria-label={`${label}外觀`}
        onKeyDown={onGridKey}
        className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] content-start gap-2 px-4 pb-4 lg:max-h-[min(56vh,560px)] lg:overflow-y-auto"
      >
        <TooltipTrigger
          handle={tip}
          payload={{ label, look: null, hasBase }}
          data-cell
          role="option"
          aria-selected={selectedKey == null}
          aria-label={noneLabel(label, hasBase)}
          tabIndex={focusAt === 0 ? 0 : -1}
          onClick={() => {
            setFocus(0);
            onWear(null);
          }}
          className={cn(cellClass, "bg-muted text-muted-foreground")}
        >
          {hasBase ? (
            slotIcon(slot, "size-[18px]")
          ) : (
            <BanIcon className="size-[18px]" aria-hidden />
          )}
        </TooltipTrigger>

        {visible.map((look, idx) => {
          const i = idx + 1;
          const n = look.items.length;
          const on = look.key === selectedKey;
          const first = look.items[0]?.name ?? "未命名外觀";
          return (
            <TooltipTrigger
              key={look.key}
              handle={tip}
              payload={{ label, look }}
              data-cell
              role="option"
              aria-selected={on}
              aria-label={n > 1 ? `${first} 等 ${n} 件道具` : first}
              tabIndex={focusAt === i ? 0 : -1}
              onClick={() => {
                setFocus(i);
                onWear(look);
              }}
              className={cn(
                cellClass,
                "group/cell",
                !look.icon &&
                  "bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--muted)_70%,transparent)_0_5px,transparent_5px_10px)] text-muted-foreground",
              )}
            >
              {look.icon ? (
                // eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink
                <img
                  src={look.icon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "h-auto max-h-10 w-auto max-w-10 [image-rendering:pixelated]",
                    !look.hasImage && "opacity-50",
                  )}
                />
              ) : (
                slotIcon(slot, "size-[19px] opacity-75")
              )}
              {n > 1 && (
                <span className="absolute top-0 right-0 rounded-bl-[5px] bg-muted/90 px-[3px] py-0.5 text-[9.5px] leading-none text-muted-foreground tabular-nums group-aria-selected/cell:bg-primary group-aria-selected/cell:text-primary-foreground">
                  {n}
                </span>
              )}
              {on && (
                <CheckIcon
                  className="absolute bottom-0.5 left-0.5 size-3 stroke-3 text-primary"
                  aria-hidden
                />
              )}
            </TooltipTrigger>
          );
        })}

        {looks && visible.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
            找不到符合的道具。
          </p>
        )}
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  hint,
  className,
}: {
  title: string;
  hint: React.ReactNode;
  className?: string;
}) {
  return (
    <CardHeader
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border/60 py-3 [.border-b]:pb-3",
        className,
      )}
    >
      <CardTitle className="font-semibold">{title}</CardTitle>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </CardHeader>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-b-2 border-border bg-background px-1.5 font-sans text-[11px]">
      {children}
    </kbd>
  );
}

function WornLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-2 text-sm">
      <span className="w-11 shrink-0 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function WornGroup({ label, look, flags }: { label: string; look: DollLook; flags: string[] }) {
  const n = look.items.length;
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/worn flex min-w-0 items-center gap-2.5 rounded-sm py-2 text-sm">
        <span className="w-11 shrink-0 text-xs text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 truncate group-hover/worn:text-primary">
          {look.items[0]?.name ?? "未命名外觀"}
        </span>
        {flags.map((f) => (
          <Badge key={f} variant="secondary" className="shrink-0 font-normal text-muted-foreground">
            {f}
          </Badge>
        ))}
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {n > 1 ? `等 ${n} 件` : "1 件"}
        </span>
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/worn:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-wrap gap-1.5 pb-3 pl-[54px]">
          {look.items.map((it) => (
            <Badge
              key={it.itemId}
              variant="outline"
              className="h-6 bg-background px-2.5 font-normal"
              render={<Link href={`/items/${it.itemId}`} />}
            >
              {it.name}
              {it.isExtra && (
                <Badge className="h-4 rounded px-1 text-[10px]" variant="secondary">
                  時裝
                </Badge>
              )}
            </Badge>
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/** 色票裡放大看頭頂那一塊：2 倍、以圖寬中線和圖高 16% 處（頭頂，避開額頭皮膚）為中心 */
const SWATCH_PX = 24;
const SWATCH_ZOOM = 2;
const SWATCH_FOCUS_Y = 0.16;

/**
 * 髮色色票：直接用遊戲預先染好的頭型圖（正面、站立優先），裁出頭髮那一塊。
 * doll_hair_colors 的 r/g/b 是染劑參數不是顯示色，所以不拿來畫；某色沒有圖就不列。
 */
function HairSwatches({
  options,
  frames,
  value,
  onChange,
}: {
  options: DollHairColor[];
  /** 目前頭型、方向 7 的所有頭型圖（各色、各動作） */
  frames: DollFrame[];
  value: number;
  onChange: (color: number) => void;
}) {
  const frameOf = (color: number) =>
    frames.find((f) => f.color === color && f.action === "wait") ??
    frames.find((f) => f.color === color);
  const items = [{ color: 0, label: "原色" }, ...options]
    .map((o) => ({ color: o.color, label: o.label, frame: frameOf(o.color) }))
    .filter((it): it is { color: number; label: string; frame: DollFrame } => !!it.frame);
  if (items.length <= 1) return null;
  const current = items.find((it) => it.color === value)?.label ?? "原色";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/60 px-4 py-2.5">
      <span className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
        髮色
        {/* 觸控裝置沒有 tooltip，目前選的顏色直接寫出來 */}
        <span className="text-foreground/80">{current}</span>
      </span>
      <ToggleGroup
        aria-label="髮色"
        value={[String(value)]}
        onValueChange={(v) => v[0] && onChange(Number(v[0]))}
        className="flex flex-wrap gap-1 border-0 bg-transparent p-1 sm:gap-1.5"
      >
        {items.map(({ color, label, frame }) => (
          <Tooltip key={color}>
            <TooltipTrigger
              delay={150}
              render={
                <ToggleGroupItem
                  value={String(color)}
                  aria-label={`髮色：${label}`}
                  className={cn(
                    "relative size-6 shrink-0 overflow-hidden rounded-full border border-foreground/15 bg-background p-0 hover:border-foreground/40 data-pressed:bg-background data-pressed:shadow-none data-pressed:ring-2 data-pressed:ring-primary data-pressed:ring-offset-2 data-pressed:ring-offset-card",
                    // 原色：虛線外框，跟染過的色票區隔（棕色在多數頭型跟原色同一張圖，靠這個和名稱分辨）
                    color === 0 && "border-dashed border-foreground/50",
                  )}
                />
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 像素原圖 hotlink */}
              <img
                src={frame.url}
                alt=""
                loading="lazy"
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none [image-rendering:pixelated]"
                style={{
                  width: frame.width * SWATCH_ZOOM,
                  height: frame.height * SWATCH_ZOOM,
                  left: SWATCH_PX / 2 - (frame.width * SWATCH_ZOOM) / 2,
                  top: SWATCH_PX / 2 - frame.height * SWATCH_FOCUS_Y * SWATCH_ZOOM,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
      <p className="w-full text-[11px] text-muted-foreground sm:ml-auto sm:w-auto">
        染髮顏色為估算，與遊戲可能有落差
      </p>
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
      className="absolute right-2.5 bottom-2.5 block h-[104px] w-[104px] rounded-full border-border/70 bg-card/80 p-0 shadow-sm backdrop-blur-sm sm:h-[118px] sm:w-[118px] lg:right-[18px] lg:bottom-[18px] lg:h-[148px] lg:w-[148px]"
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
        <b className="block font-heading text-sm leading-tight text-foreground lg:text-[15px]">
          {DIR_NAME[dir]}
        </b>
        <span className="text-[10px] tracking-wider text-muted-foreground">DIR {dir}</span>
      </div>
    </ToggleGroup>
  );
}
