"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowDownToDotIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  CrosshairIcon,
  EyeOffIcon,
  InfoIcon,
  LoaderPinwheelIcon,
  Maximize2Icon,
  Minimize2Icon,
  RouteIcon,
  SplitIcon,
} from "lucide-react";
import {
  cropFrame,
  formatStatusResistance,
  fullFrameBox,
  toPercent,
  type Crop,
  type Point,
  type StepData,
  type StepGroup,
  type StepMark,
  type StepRoute,
  type StepRoutePoint,
  type StepWalk,
} from "@/lib/guide-steps";
import { GRID_LAYOUT } from "@/lib/solvers/forest-matrix";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ── 共用狀態：表格列、地圖標記、九宮格互相高亮 ── */

interface StepState {
  data: StepData;
  /** 點選固定的組別（group.key）。 */
  active: string | null;
  setActive: (key: string | null) => void;
  /** 滑鼠停留中的組別，優先於 active。 */
  hover: string | null;
  setHover: (key: string | null) => void;
  room: string | null;
  setRoom: (room: string | null) => void;
  /** 路線分頁目前打開的路線（label）；null＝第一條。 */
  route: string | null;
  setRoute: (label: string | null) => void;
  /** 路線分頁的 DOM id，總覽圖點落點時捲過去。 */
  tabsId: string;
}

const StepContext = createContext<StepState | null>(null);

function useStep(): StepState {
  const ctx = useContext(StepContext);
  if (!ctx) throw new Error("StepMap / StepTargets / NineRoomGrid 必須放在 <DungeonStep> 裡");
  return ctx;
}

export function StepProvider({ data, children }: { data: StepData; children?: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const tabsId = `route-tabs-${svgId(useId())}`;
  return (
    <StepContext.Provider
      value={{ data, active, setActive, hover, setHover, room, setRoom, route, setRoute, tabsId }}
    >
      {children}
    </StepContext.Provider>
  );
}

const lit = (s: StepState) => s.hover ?? s.active;
const toggle = (cur: string | null, key: string) => (cur === key ? null : key);
const mk = (color: number) => ({ "--mk": `var(--marker-${color})` }) as CSSProperties;
const pos = (p: { left: number; top: number }) => ({ left: `${p.left}%`, top: `${p.top}%` });
const fmt = (n: number) => n.toLocaleString("zh-TW");

function centroid(points: Point[]): Point {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

function groupName(g: StepGroup) {
  return g.rows[0]?.name ?? "";
}

/* ── 地圖 ── */

// 32px 點擊範圍；位移用 translate、縮放用 scale 屬性，不和 animate-in 的 transform 打架。
const hit =
  "absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-hidden focus-visible:ring-3 focus-visible:ring-ring/70";
const enter =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:duration-300 motion-safe:[animation-fill-mode:both]";

function GroupMarker({
  group,
  at,
  index,
}: {
  group: StepGroup;
  at: { left: number; top: number };
  index: number;
}) {
  const s = useStep();
  const on = lit(s) === group.key;
  const dim = lit(s) != null && !on;
  const name = groupName(group);
  const label = `${group.color} 號：${name}${group.tag ? `（${group.tag}）` : ""}`;
  const area = group.as === "area";

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={0}
        aria-label={label}
        aria-pressed={s.active === group.key}
        data-marker={group.key}
        onClick={() => s.setActive(toggle(s.active, group.key))}
        onMouseEnter={() => s.setHover(group.key)}
        onMouseLeave={() => s.setHover(null)}
        onFocus={() => s.setHover(group.key)}
        onBlur={() => s.setHover(null)}
        style={{ ...pos(at), ...mk(group.color), animationDelay: `${index * 40}ms` }}
        className={cn(
          hit,
          enter,
          "z-[2] cursor-pointer motion-safe:transition-[opacity,scale] motion-safe:duration-200 hover:z-[4]",
          area && "size-11",
          on && "z-[5] scale-125",
          dim && "opacity-35",
        )}
      >
        {area ? (
          <span className="relative block size-full rounded-full border-2 border-dashed border-(--mk) bg-white/25 shadow-[0_0_0_1px_rgb(255_255_255/0.5)]">
            <span className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2 rounded-full bg-(--mk) px-1.5 text-[11px] leading-[1.6] font-semibold whitespace-nowrap text-white shadow-[0_1px_3px_rgb(0_0_0/0.35)]">
              {group.tag ?? group.color}
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "grid place-items-center rounded-full border-2 border-white bg-(--mk) font-bold text-white tabular-nums shadow-[0_1px_3px_rgb(0_0_0/0.45)]",
              group.as === "dot" ? "size-3.5" : "size-[22px] text-[11px] leading-none",
              on && "shadow-[0_0_0_3px_rgb(255_255_255/0.85),0_2px_10px_rgb(0_0_0/0.5)]",
            )}
          >
            {group.as === "pin" && group.color}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 flex-row items-start gap-3">
        <EntityPortrait image={group.rows[0]?.image} alt={name} size="sm" className="size-11" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span
              style={mk(group.color)}
              className="grid size-5 shrink-0 place-items-center rounded-full bg-(--mk) text-[10.5px] font-bold text-white"
            >
              {group.color}
            </span>
            <span className="truncate font-medium">{name}</span>
            {group.tag && (
              <Badge variant="outline" className="font-normal">
                {group.tag}
              </Badge>
            )}
          </div>
          {group.rows.map((r) => (
            <p key={r.id} className="text-muted-foreground text-xs tabular-nums">
              <span className="text-foreground font-medium">Lv {r.level}</span>
              <span className="mx-1.5">·</span>HP {fmt(r.hp)}
            </p>
          ))}
          {group.rows[0] && (
            <Link
              href={`/monsters/${group.rows[0].id}`}
              className="text-primary inline-flex items-center gap-0.5 pt-0.5 text-xs font-medium underline-offset-4 hover:underline"
            >
              怪物資料
              <ChevronRightIcon className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MarkPin({ mark, at }: { mark: StepMark; at: { left: number; top: number } }) {
  const s = useStep();
  const text = mark.label ?? mark.name;
  const dashed = mark.tbd && "border-dashed";

  if (mark.as === "room") {
    const on = s.room === text;
    return (
      <button
        type="button"
        aria-label={`${text}之間`}
        aria-pressed={on}
        data-room={text}
        onClick={() => s.setRoom(toggle(s.room, text))}
        style={pos(at)}
        className={cn(
          hit,
          "z-[3] cursor-pointer motion-safe:transition-[scale] hover:scale-110",
          on && "z-[5] scale-125",
        )}
      >
        <span
          className={cn(
            "font-heading grid h-[26px] min-w-[30px] place-items-center rounded-md border-[1.5px] px-1.5 text-[13px] font-semibold shadow-[0_1px_3px_rgb(0_0_0/0.3)]",
            on
              ? "border-(--stop) bg-(--stop) text-background"
              : "border-foreground/60 bg-card/95 text-foreground",
            dashed,
          )}
        >
          {text}
        </span>
      </button>
    );
  }

  const title = mark.tbd ? `${mark.name}（位置待確認）` : mark.name;
  return (
    <span
      role="img"
      aria-label={mark.as === "ok" ? `${mark.name}：已完成，不可攻擊` : title}
      title={title}
      style={pos(at)}
      className={cn(hit, "pointer-events-auto z-[1]")}
    >
      {mark.as === "npc" && (
        <span
          className={cn(
            "grid size-[22px] rotate-45 place-items-center rounded-[5px] border-2 border-white bg-(--stop) text-[11px] font-bold text-white shadow-[0_1px_3px_rgb(0_0_0/0.45)]",
            dashed,
          )}
        >
          <span className="-rotate-45">{[...text][0]}</span>
        </span>
      )}
      {mark.as === "device" && (
        <span
          className={cn(
            "grid h-[21px] place-items-center rounded-[5px] border-2 border-white bg-foreground/85 px-1.5 text-[11px] font-semibold whitespace-nowrap text-background shadow-[0_1px_3px_rgb(0_0_0/0.45)]",
            dashed,
          )}
        >
          {text}
        </span>
      )}
      {mark.as === "ok" && (
        <span
          className={cn(
            "bg-card/95 grid size-[21px] place-items-center rounded-full border-2 border-(--marker-3) text-(--marker-3) shadow-[0_1px_3px_rgb(0_0_0/0.25)]",
            dashed,
          )}
        >
          <CheckIcon className="size-3" strokeWidth={3} aria-hidden />
        </span>
      )}
    </span>
  );
}

function Layer({ data, crop }: { data: StepData; crop: StepData["crop"] }) {
  const img = data.image!;
  const at = (p: Point) => toPercent(p, img, crop);
  let i = 0;
  return (
    <>
      {data.marks.flatMap((m) =>
        m.points.map((p, j) => <MarkPin key={`${m.key}-${j}`} mark={m} at={at(p)} />),
      )}
      {data.groups
        .filter((g) => g.map && g.points.length > 0)
        .flatMap((g) =>
          g.as === "area"
            ? [<GroupMarker key={g.key} group={g} at={at(centroid(g.points))} index={i++} />]
            : g.points.map((p, j) => (
                <GroupMarker key={`${g.key}-${j}`} group={g} at={at(p)} index={i++} />
              )),
        )}
    </>
  );
}

/* ── 可行走通道 ── */

interface WalkView {
  show: boolean;
  /** 圖例滑過／點選中的通道 index；其他通道變淡。 */
  lit: number | null;
}

// ponytail: 只有兩組色／紋路，第三條起循環；真有三條以上再加 --walk-3。
const walkColor = (i: number) => `var(--walk-${(i % 2) + 1})`;
const dotted = (i: number) => i % 2 === 1;
const svgId = (id: string) => id.replace(/[^\w-]/g, "");

/** 單數通道斜條紋、雙數通道圓點；period 用 SVG 使用者座標（地圖上是原圖像素）。 */
function WalkPattern({ id, i, period }: { id: string; i: number; period: number }) {
  const fill = { fill: walkColor(i) };
  return dotted(i) ? (
    <pattern id={id} patternUnits="userSpaceOnUse" width={period} height={period}>
      <rect width={period} height={period} style={fill} fillOpacity={0.13} />
      <circle cx={period / 4} cy={period / 4} r={period * 0.15} style={fill} fillOpacity={0.7} />
      <circle
        cx={(period * 3) / 4}
        cy={(period * 3) / 4}
        r={period * 0.15}
        style={fill}
        fillOpacity={0.7}
      />
    </pattern>
  ) : (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={period}
      height={period}
      patternTransform="rotate(45)"
    >
      <rect width={period} height={period} style={fill} fillOpacity={0.13} />
      <rect width={period * 0.2} height={period} style={fill} fillOpacity={0.6} />
    </pattern>
  );
}

/** 通道圖層：viewBox 直接用裁切框（或整張圖）的原圖像素，path 不必換算百分比。 */
function WalkLayer({ walk, box, view }: { walk: StepWalk[]; box: string; view: WalkView }) {
  const uid = svgId(useId());
  return (
    <svg
      aria-hidden
      data-testid="walk-layer"
      viewBox={box}
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-0 size-full motion-safe:transition-opacity motion-safe:duration-200",
        !view.show && "opacity-0",
      )}
    >
      <defs>
        {walk.map((_, i) => (
          <WalkPattern key={i} id={`${uid}-${i}`} i={i} period={dotted(i) ? 28 : 30} />
        ))}
      </defs>
      {walk.map((w, i) => {
        const on = view.lit === i;
        return (
          <g
            key={i}
            className={cn(
              "motion-safe:transition-opacity motion-safe:duration-200",
              view.lit != null && !on && "opacity-20",
            )}
          >
            <path d={w.path} fill={`url(#${uid}-${i})`} fillRule="evenodd" />
            <path
              d={w.path}
              fill="none"
              stroke="var(--walk-halo)"
              strokeWidth={on ? 6 : 5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={w.path}
              fill="none"
              style={{ stroke: walkColor(i) }}
              strokeWidth={on ? 3.25 : 2.25}
              strokeDasharray={dotted(i) ? "7 4" : undefined}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

const pill =
  "pointer-events-none absolute -translate-x-1/2 rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap text-[oklch(0.2_0.02_260)] shadow-[0_0_0_1.5px_var(--walk-halo),0_1px_4px_rgb(0_0_0/0.4)] motion-safe:transition-opacity motion-safe:duration-200";

function WalkLabels({
  data,
  crop,
  view,
}: {
  data: StepData;
  crop: StepData["crop"];
  view: WalkView;
}) {
  return (data.walk ?? []).map((w, i) => (
    <span
      key={i}
      aria-hidden
      style={{ ...pos(toPercent(w.labelAt, data.image!, crop)), background: walkColor(i) }}
      className={cn(
        pill,
        "-translate-y-1/2",
        !view.show ? "opacity-0" : view.lit != null && view.lit !== i && "opacity-25",
      )}
    >
      {w.label}
    </span>
  ));
}

const WALK_POINT = {
  portal: { Icon: LoaderPinwheelIcon, name: "傳點", shape: "rounded-full" },
  landing: { Icon: ArrowDownToDotIcon, name: "落點", shape: "rounded-md" },
} as const;
const ink = "border-[oklch(0.2_0.02_260)] text-[oklch(0.2_0.02_260)]";

/**
 * 傳點（圓形＋漩渦）與落點（方角＋落地箭頭），填各自通道色、深色邊與圖示，
 * 和怪物標記（白邊、白字）分得開。放在怪物標記下層；只看某條通道時，其他通道的點直接藏起來。
 */
function WalkPoints({
  data,
  crop,
  view,
}: {
  data: StepData;
  crop: StepData["crop"];
  view: WalkView;
}) {
  const img = data.image!;
  return (data.walk ?? []).flatMap((w, i) => {
    const off = !view.show || (view.lit != null && view.lit !== i);
    return (["portal", "landing"] as const).flatMap((kind) => {
      const p = w[kind];
      if (!p) return [];
      const { Icon, name, shape } = WALK_POINT[kind];
      return [
        <span
          key={`${i}-${kind}`}
          role="img"
          aria-label={`${w.label}${name}`}
          aria-hidden={off || undefined}
          title={`${w.label}${name}`}
          data-walk-point={kind}
          style={{ ...pos(toPercent(p, img, crop)), background: walkColor(i) }}
          className={cn(
            "absolute z-[1] grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 shadow-[0_0_0_1.5px_rgb(255_255_255/0.75),0_1px_4px_rgb(0_0_0/0.45)] motion-safe:transition-opacity motion-safe:duration-200",
            ink,
            shape,
            off && "pointer-events-none opacity-0",
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
        </span>,
      ];
    });
  });
}

/** 圖例用的傳點／落點小圖：平常混色，只看某條通道／路線時換成那一條的顏色。 */
function WalkPointSwatch({ kind, color }: { kind: keyof typeof WALK_POINT; color: string }) {
  const { Icon, shape } = WALK_POINT[kind];
  return (
    <span
      aria-hidden
      style={{ background: color }}
      className={cn("grid size-4 shrink-0 place-items-center border-[1.5px]", ink, shape)}
    >
      <Icon className="size-2.5" strokeWidth={2.75} />
    </span>
  );
}

/** 圖例色塊：小塊暗底＋同款紋路與邊線，淺色／深色主題看起來一樣。 */
function WalkSwatch({ i }: { i: number }) {
  const id = svgId(useId());
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0 overflow-visible" aria-hidden>
      <defs>
        <WalkPattern id={id} i={i} period={4} />
      </defs>
      <rect x=".75" y=".75" width="16.5" height="10.5" rx="2" fill="oklch(0.2 0.02 260)" />
      <rect
        x=".75"
        y=".75"
        width="16.5"
        height="10.5"
        rx="2"
        fill={`url(#${id})`}
        style={{ stroke: walkColor(i) }}
        strokeWidth={1.5}
        strokeDasharray={dotted(i) ? "3 2" : undefined}
      />
    </svg>
  );
}

/* ── 路線（例如跳島走法）── */

// ponytail: 五色循環；超過五條路線才會撞色，到時再加 --route-6。
const routeColor = (i: number) => `var(--route-${(i % 5) + 1})`;
const ROUTE_MIX = "linear-gradient(135deg, var(--route-1), var(--route-3), var(--route-5))";
const lineGap = 260; // 原圖像素；短於這個長度的線段不畫方向箭頭，免得擠在兩個標記中間

interface RouteSeg {
  a: StepRoutePoint;
  b: StepRoutePoint;
  /** 從傳點出發的那段是傳送，畫弧線。 */
  jump: boolean;
  /** 弧線彎曲量：正值往行進方向左側、負值往右側，單位是弦長。 */
  bend: number;
}

/** 弧線控制點：從弦的中點往側邊推出 bend 倍弦長。 */
const ctrl = (a: Point, b: Point, bend: number) => ({
  x: (a.x + b.x) / 2 + (b.y - a.y) * bend,
  y: (a.y + b.y) / 2 - (b.x - a.x) * bend,
});

// 預設往左彎 28%；離其他標記太近時才依序試另一側、彎大一點，挑離標記最遠的
const BENDS = [0.28, -0.28, 0.45, -0.45];
const arcRoom = 140; // 原圖像素；預設彎法和所有標記至少隔這麼遠就不換

/** 弧線中段（兩端各留 10%）離最近標記的距離；弧線自己的兩端不算。 */
function clearance(a: Point, b: Point, bend: number, avoid: Point[]) {
  const c = ctrl(a, b, bend);
  const others = avoid.filter((o) => !(o.x === a.x && o.y === a.y) && !(o.x === b.x && o.y === b.y));
  let min = Infinity;
  for (let t = 0.1; t <= 0.9001; t += 0.05) {
    const u = 1 - t;
    const x = u * u * a.x + 2 * t * u * c.x + t * t * b.x;
    const y = u * u * a.y + 2 * t * u * c.y + t * t * b.y;
    for (const o of others) min = Math.min(min, Math.hypot(x - o.x, y - o.y));
  }
  return min;
}

/**
 * 路線拆成線段。傳送弧線會避開 avoid 裡的點（王、怪物、其他路線標記）：
 * 預設彎法夠空就照用，不然改用離標記最遠的彎法，免得弧線和箭頭壓在王身上。
 */
function routeSegs(r: StepRoute, avoid: Point[]): RouteSeg[] {
  return r.points.slice(1).map((b, k) => {
    const a = r.points[k];
    const jump = a.as === "portal";
    if (!jump) return { a, b, jump, bend: 0 };
    const room = BENDS.map((bend) => ({ bend, room: clearance(a, b, bend, avoid) }));
    const best =
      room[0].room >= arcRoom ? room[0] : room.reduce((m, o) => (o.room > m.room ? o : m));
    return { a, b, jump, bend: best.bend };
  });
}

/** 弧線要避開的點：所有路線上的點，加上地圖上的怪物標記。 */
const routeAvoid = (data: StepData): Point[] => [
  ...(data.routes ?? []).flatMap((r) => r.points),
  ...data.groups.filter((g) => g.map).flatMap((g) => g.points),
];

/** 傳送弧線：二次貝茲曲線。 */
function arc({ a, b, bend }: RouteSeg) {
  const c = ctrl(a, b, bend);
  return {
    d: `M${a.x} ${a.y}Q${c.x} ${c.y} ${b.x} ${b.y}`,
    // t=0.5 的點與切線（切線平行於弦）
    mid: { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 },
  };
}

/** 路線線條：步行是實線，傳送是點狀弧線；都墊一條深色底邊，壓在任何底圖上都讀得到。 */
function RouteLayer({ segs, color, box }: { segs: RouteSeg[]; color: string; box: string }) {
  return (
    <svg
      aria-hidden
      data-testid="route-layer"
      viewBox={box}
      preserveAspectRatio="none"
      style={{ stroke: color }}
      className="pointer-events-none absolute inset-0 size-full"
    >
      {segs.map((seg, k) => {
        const d = seg.jump ? arc(seg).d : `M${seg.a.x} ${seg.a.y}L${seg.b.x} ${seg.b.y}`;
        return (
          <g key={k} data-seg={seg.jump ? "jump" : "walk"}>
            <path
              d={d}
              fill="none"
              stroke="var(--walk-halo)"
              strokeWidth={seg.jump ? 6 : 7}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={d}
              fill="none"
              strokeWidth={seg.jump ? 3 : 3.5}
              strokeDasharray={seg.jump ? "0.5 7" : undefined}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

const bossRing =
  "rounded-full bg-[oklch(0.14_0.02_260/0.55)] shadow-[0_0_0_1.5px_var(--walk-halo),inset_0_0_0_1.5px_var(--walk-halo),0_1px_6px_rgb(0_0_0/0.5)]";

/**
 * 路線上的標記（HTML，大小不隨地圖縮放）：起點落點、傳點＋踩的順序、傳送後的落點、
 * 王的外圈（圈在怪物標記外面，怪物標記仍在上層）、線段中間的方向箭頭。
 */
function RouteMarks({
  route: r,
  color,
  segs,
  at,
}: {
  route: StepRoute;
  color: string;
  segs: RouteSeg[];
  at: (p: Point) => { left: number; top: number };
}) {
  let step = 0;
  const marks = r.points.flatMap((p, k) => {
    const key = `p${k}`;
    if (p.as === "walk") return [];
    if (p.as === "boss") {
      return [
        <span
          key={key}
          aria-hidden
          data-route-point="boss"
          style={{ ...pos(at(p)), borderColor: color }}
          className={cn(
            // z-[2]：壓過路線線條、箭頭和落點；怪物標記同層但排在後面，仍在最上面。
            // 圈內墊半透明深色，穿過的線條淡下去，王一眼看得出來。
            "pointer-events-none absolute z-[2] size-9 -translate-x-1/2 -translate-y-1/2 border-[3px]",
            bossRing,
          )}
        />,
      ];
    }
    const portal = p.as === "portal";
    if (portal) step++;
    const start = k === 0;
    const { Icon, shape } = WALK_POINT[portal ? "portal" : "landing"];
    const name = portal
      ? `${r.label}第 ${step} 個傳點`
      : start
        ? `${r.label}起點`
        : `${r.label}第 ${step} 跳落點`;
    return [
      <span
        key={key}
        role="img"
        aria-label={name}
        title={name}
        data-route-point={p.as}
        style={{ ...pos(at(p)), background: color }}
        className={cn(
          "absolute z-[1] grid -translate-x-1/2 -translate-y-1/2 place-items-center border-2 shadow-[0_0_0_1.5px_rgb(255_255_255/0.75),0_1px_4px_rgb(0_0_0/0.45)]",
          portal || start ? "size-6" : "size-5",
          ink,
          shape,
        )}
      >
        <Icon className={portal || start ? "size-3.5" : "size-3"} strokeWidth={2.5} aria-hidden />
        {portal && (
          <b className="absolute -top-2 -right-2 grid size-4 place-items-center rounded-full bg-[oklch(0.2_0.02_260)] text-[10px] leading-none font-bold text-white tabular-nums shadow-[0_0_0_1.5px_rgb(255_255_255/0.85)]">
            {step}
          </b>
        )}
      </span>,
      ...(start
        ? [
            <span
              key={`${key}-label`}
              aria-hidden
              style={{ ...pos(at(p)), background: color }}
              className={cn(
                pill,
                "z-[1]",
                // 太靠近上緣時改放在標記下方，免得被裁掉
                at(p).top < 8 ? "translate-y-4" : "-translate-y-[calc(100%+16px)]",
              )}
            >
              起點
            </span>,
          ]
        : []),
    ];
  });
  const arrows = segs.flatMap((seg, k) => {
    const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
    if (len < lineGap) return [];
    const mid = seg.jump
      ? arc(seg).mid
      : { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
    const deg = (Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) * 180) / Math.PI;
    return [
      <span
        key={`a${k}`}
        aria-hidden
        data-route-arrow
        style={{ ...pos(at(mid)), color, rotate: `${deg}deg` }}
        className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 [filter:drop-shadow(0_0_1.5px_oklch(0.12_0.02_260))_drop-shadow(0_0_1px_oklch(0.12_0.02_260))]"
      >
        <ChevronRightIcon className="size-4" strokeWidth={3.5} />
      </span>,
    ];
  });
  return [...arrows, ...marks];
}

/** 圖例用的路線小圖：一小段實線接一段點狀弧線。 */
function RouteSwatch({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 18 12"
      className="h-3 w-[18px] shrink-0"
      aria-hidden
      style={{ stroke: color }}
    >
      <rect width="18" height="12" rx="2" fill="oklch(0.2 0.02 260)" stroke="none" />
      <path d="M2.5 9.5H8" fill="none" strokeWidth={2} strokeLinecap="round" />
      <path
        d="M8 9.5Q11 1 15.5 6"
        fill="none"
        strokeWidth={1.75}
        strokeDasharray="0.1 2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 打開某條路線的分頁，並把分頁捲進畫面。 */
function openRoute(s: StepState, label: string) {
  s.setRoute(label);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(s.tabsId)
    ?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/**
 * 總覽圖上的落點：只標每條路線的起點＋名稱，讓玩家對座標找出自己在哪一條。
 * 點一下切到那條路線的分頁（RouteTabs）並捲過去。
 */
function RouteLandings({
  data,
  crop,
  labels,
}: {
  data: StepData;
  crop: StepData["crop"];
  labels: boolean;
}) {
  const s = useStep();
  const img = data.image!;
  return (data.routes ?? []).map((r, i) => {
    const at = toPercent(r.points[0], img, crop);
    const color = routeColor(i);
    return (
      <button
        key={r.label}
        type="button"
        data-route-landing={r.label}
        aria-label={`${r.label}落點：看這裡的走法`}
        title={`${r.label}落點`}
        onClick={() => openRoute(s, r.label)}
        style={pos(at)}
        className={cn(
          hit,
          "group/landing z-[3] cursor-pointer motion-safe:transition-[scale] motion-safe:duration-150 hover:scale-110",
        )}
      >
        <span
          style={{ background: color }}
          className={cn(
            "grid size-6 place-items-center rounded-md border-2 shadow-[0_0_0_1.5px_rgb(255_255_255/0.75),0_1px_4px_rgb(0_0_0/0.45)]",
            ink,
          )}
        >
          <ArrowDownToDotIcon className="size-3.5" strokeWidth={2.5} aria-hidden />
        </span>
        {labels && (
          <span
            aria-hidden
            style={{ background: color }}
            className={cn(
              pill,
              // 放在標記旁邊而不是上方：手機上地圖很矮，貼近上緣的島名才不會被裁掉
              "top-1/2 translate-x-0 -translate-y-1/2 group-hover/landing:underline",
              at.left > 80 ? "right-full" : "left-full",
            )}
          >
            {r.label}
          </span>
        )}
      </button>
    );
  });
}

interface WalkLegendProps {
  view: WalkView;
  pin: number | null;
  setPin: (i: number | null) => void;
  setPeek: (i: number | null) => void;
}

const legendButton =
  "hover:bg-muted/50 aria-pressed:bg-muted focus-visible:ring-ring/60 -mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 outline-hidden focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50";

/** 圖例裡「只看這一條通道」的按鈕：滑過／聚焦時先預覽，點一下固定。 */
function SoloButton({
  i,
  label,
  props,
  children,
}: {
  i: number;
  label: string;
  props: WalkLegendProps;
  children: ReactNode;
}) {
  const { view, pin, setPin, setPeek } = props;
  return (
    <button
      type="button"
      aria-pressed={pin === i}
      aria-label={`只看${label}`}
      disabled={!view.show}
      onClick={() => setPin(pin === i ? null : i)}
      onMouseEnter={() => setPeek(i)}
      onMouseLeave={() => setPeek(null)}
      onFocus={() => setPeek(i)}
      onBlur={() => setPeek(null)}
      className={legendButton}
    >
      {children}
    </button>
  );
}

function Legend({ data, walkProps }: { data: StepData; walkProps: WalkLegendProps }) {
  const marks = data.marks.filter((m) => m.as !== "room");
  const numbered = data.groups.some((g) => g.map && g.points.length > 0 && g.as !== "area");
  const walk = data.walk ?? [];
  const routes = data.routes ?? [];
  const { view } = walkProps;
  if (marks.length === 0 && !numbered && walk.length === 0 && routes.length === 0) return null;
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2.5 text-[12.5px] leading-relaxed">
      {routes.length > 0 && (
        <li data-legend="route-landing" className="inline-flex basis-full items-center gap-1.5">
          <WalkPointSwatch kind="landing" color={ROUTE_MIX} />
          <span className="text-foreground/85 shrink-0">落點</span>
          <span>・找到自己站的那一個，點它，下方分頁會切到那裡的走法。</span>
        </li>
      )}
      {walk.map((w, i) => (
        <li key={`walk-${i}`}>
          <SoloButton i={i} label={w.label} props={walkProps}>
            <WalkSwatch i={i} />
            <span className="text-foreground/85">{w.label}</span>
            {w.note && <span>・{w.note}</span>}
          </SoloButton>
        </li>
      ))}
      {(["portal", "landing"] as const)
        .filter((kind) => walk.some((w) => w[kind]))
        .map((kind) => (
          <li
            key={kind}
            data-legend={kind}
            className={cn("inline-flex items-center gap-1.5", !view.show && "opacity-50")}
          >
            <WalkPointSwatch
              kind={kind}
              color={
                view.lit != null
                  ? walkColor(view.lit)
                  : "linear-gradient(135deg, var(--walk-1) 50%, var(--walk-2) 50%)"
              }
            />
            <span className="text-foreground/85">{WALK_POINT[kind].name}</span>
            <span>・{kind === "portal" ? "清完走上去傳送" : "傳送過來時出現的位置"}</span>
          </li>
        ))}
      {walk.length >= 2 && (
        <li className="inline-flex basis-full items-center gap-1.5">
          <SplitIcon className="size-3.5 shrink-0" aria-hidden />
          <span>
            {walk.length === 2 ? "兩" : walk.length}條通道互不相通：看得到對面的人，也走不過去。
          </span>
        </li>
      )}
      {marks.map((m) => (
        <li key={m.key} className="inline-flex items-center gap-1.5">
          {m.as === "npc" && (
            <span className="size-2.5 rotate-45 rounded-[2px] bg-(--stop)" aria-hidden />
          )}
          {m.as === "device" && (
            <span className="bg-foreground/85 h-2.5 w-3.5 rounded-[2px]" aria-hidden />
          )}
          {m.as === "ok" && (
            <CheckIcon className="size-3.5 text-(--marker-3)" strokeWidth={3} aria-hidden />
          )}
          <span className="text-foreground/85">
            {m.label && m.as !== "ok" ? `${m.label}・${m.name}` : m.name}
          </span>
          {m.as === "ok" && <span>＝已完成，不可攻擊</span>}
          {(m.tbd || m.points.length === 0) && <span>（位置待確認）</span>}
        </li>
      ))}
      {numbered && <li>圓點編號對應下方表格，滑過或點一下可以對照。</li>}
    </ul>
  );
}

const viewBox = (c: Crop) => `${c[0]} ${c[1]} ${c[2] - c[0]} ${c[3] - c[1]}`;

/**
 * 地圖：預設只看本區塊，可切到完整地圖（會框出本區塊）。沒有地圖圖檔時不顯示。
 * 有路線時這張是總覽：只標各路線的落點，完整走法放在 RouteTabs 的分頁裡。
 */
export function StepMap({ alt }: { alt?: string }) {
  const s = useStep();
  const { data } = s;
  const [full, setFull] = useState(false);
  const [showWalk, setShowWalk] = useState(true);
  const [pin, setPin] = useState<number | null>(null);
  const [peek, setPeek] = useState<number | null>(null);
  const img = data.image;
  if (!img) return null;

  const walk = data.walk ?? [];
  const view: WalkView = { show: showWalk, lit: peek ?? pin };
  const crop = data.crop;
  const showCrop = crop != null && !full;
  const label = alt ?? `${data.stageName}地圖`;

  return (
    <figure className="bg-card my-5 overflow-hidden rounded-xl border">
      {showCrop ? (
        <CropView data={data} crop={crop} alt={`${label}（本區塊）`}>
          {walk.length > 0 && (
            <>
              <WalkLayer walk={walk} box={viewBox(crop)} view={view} />
              <WalkLabels data={data} crop={crop} view={view} />
              <WalkPoints data={data} crop={crop} view={view} />
            </>
          )}
          <RouteLandings data={data} crop={crop} labels />
        </CropView>
      ) : (
        <div className="bg-muted/40 overflow-x-auto">
          <div
            className="relative w-[160%] sm:w-full"
            style={{ aspectRatio: `${img.imgWidth} / ${img.imgHeight}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 與地圖頁一致，直連圖床 */}
            <img
              src={img.url}
              alt={label}
              width={img.imgWidth}
              height={img.imgHeight}
              loading="lazy"
              className="block h-auto w-full select-none"
              draggable={false}
            />
            {walk.length > 0 && (
              <WalkLayer walk={walk} box={`0 0 ${img.imgWidth} ${img.imgHeight}`} view={view} />
            )}
            {crop && (
              <span
                data-testid="step-frame"
                style={(() => {
                  const b = fullFrameBox(img, crop);
                  return {
                    left: `${b.left}%`,
                    top: `${b.top}%`,
                    width: `${b.width}%`,
                    height: `${b.height}%`,
                  };
                })()}
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-(--stop) bg-(--stop)/8 shadow-[0_0_0_9999px_rgb(0_0_0/0.18)]"
              >
                <b className="absolute -top-px left-2 -translate-y-full rounded-t-md bg-(--stop) px-2 py-0.5 text-[11.5px] font-semibold text-white">
                  本區塊
                </b>
              </span>
            )}
            <WalkPoints data={data} crop={null} view={view} />
            <RouteLandings data={data} crop={null} labels={false} />
            <Layer data={data} crop={null} />
          </div>
        </div>
      )}

      <figcaption className="border-t">
        <Legend data={data} walkProps={{ view, pin, setPin, setPeek }} />
        {(crop || walk.length > 0) && (
          <div className="flex items-center justify-between gap-3 border-t border-dashed px-3 py-2">
            <span className="text-muted-foreground text-[12px] sm:invisible">
              {full ? "地圖可左右滑動" : ""}
            </span>
            <div className="flex items-center gap-2">
              {walk.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={showWalk}
                  onClick={() => {
                    setShowWalk((v) => !v);
                    setPin(null);
                    setPeek(null);
                  }}
                  className="h-8 px-3"
                >
                  {showWalk ? <EyeOffIcon aria-hidden /> : <RouteIcon aria-hidden />}
                  {showWalk ? "隱藏通道" : "顯示通道"}
                </Button>
              )}
              {crop && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={full}
                  onClick={() => setFull((v) => !v)}
                  className="h-8 px-3"
                >
                  {full ? <Minimize2Icon aria-hidden /> : <Maximize2Icon aria-hidden />}
                  {full ? "只看本區塊" : "查看完整地圖"}
                </Button>
              )}
            </div>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

function CropView({
  data,
  crop,
  alt,
  children,
}: {
  data: StepData;
  /** 要顯示的框（本區塊，或路線的放大框）；容器比例跟著這個框。 */
  crop: Crop;
  alt: string;
  children?: ReactNode;
}) {
  const img = data.image!;
  const f = cropFrame(img, crop);
  return (
    <div
      className="bg-muted/40 relative w-full overflow-hidden"
      style={{ aspectRatio: String(f.aspect) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 與地圖頁一致，直連圖床 */}
      <img
        src={img.url}
        alt={alt}
        loading="lazy"
        draggable={false}
        style={{ width: `${f.width}%`, left: `${f.left}%`, top: `${f.top}%` }}
        className="absolute h-auto max-w-none select-none"
      />
      {children}
      <Layer data={data} crop={crop} />
    </div>
  );
}

/* ── 路線分頁 ── */

/**
 * 路線分頁：每條路線一頁，順序照 routes 資料。children 放 <RouteTab label="…">，
 * 每頁的放大路線圖由路線資料自動畫，RouteTab 的 children（步驟、座標）接在圖下方。
 */
export function RouteTabs({ children }: { children?: ReactNode }) {
  const s = useStep();
  const routes = s.data.routes ?? [];
  if (routes.length === 0 || !s.data.image) return null;
  return (
    <Tabs
      id={s.tabsId}
      value={s.route ?? routes[0].label}
      onValueChange={(v) => s.setRoute(String(v))}
      className="my-5 scroll-mt-20 gap-3"
    >
      {/* 手機放不下時可以左右滑 */}
      <div className="-mx-1 overflow-x-auto px-1 py-0.5">
        <TabsList aria-label="各路線走法" className="h-9 w-max min-w-full">
          {routes.map((r, i) => (
            <TabsTrigger
              key={r.label}
              value={r.label}
              className="gap-1.5 px-2 sm:px-3"
            >
              <span
                aria-hidden
                style={{ background: routeColor(i) }}
                className="hidden size-2.5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_oklch(0.2_0.02_260/0.35)] sm:block"
              />
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

/** 一條路線的分頁內容：放大路線圖＋children（步驟、座標對照）。 */
export function RouteTab({ label, children }: { label: string; children?: ReactNode }) {
  const { data } = useStep();
  const routes = data.routes ?? [];
  const i = routes.findIndex((r) => r.label === label);
  return (
    <TabsContent value={label} className="text-base [&_td]:whitespace-nowrap [&>:last-child]:mb-0">
      {i >= 0 && <RouteMap data={data} route={routes[i]} i={i} />}
      {children}
    </TabsContent>
  );
}

function RouteMap({ data, route, i }: { data: StepData; route: StepRoute; i: number }) {
  const img = data.image!;
  const color = routeColor(i);
  const segs = routeSegs(route, routeAvoid(data));
  const { box } = route;
  return (
    <figure data-route-map={route.label} className="bg-card mb-5 overflow-hidden rounded-xl border">
      <CropView data={data} crop={box} alt={`${data.stageName}地圖（${route.label}走法）`}>
        <RouteLayer segs={segs} color={color} box={viewBox(box)} />
        <RouteMarks route={route} color={color} segs={segs} at={(p) => toPercent(p, img, box)} />
      </CropView>
      <figcaption className="border-t">
        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-[12.5px] leading-relaxed">
          <li className="text-foreground font-medium">
            {route.label}
            {route.note && <span className="text-muted-foreground font-normal">・{route.note}</span>}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <WalkPointSwatch kind="landing" color={color} />
            <span className="text-foreground/85">落點</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <WalkPointSwatch kind="portal" color={color} />
            <span className="text-foreground/85">傳點</span>
            <span>・小數字是踩的順序</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <RouteSwatch color={color} />
            <span>實線走過去，點狀弧線是傳送</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              style={{ borderColor: color }}
              className={cn("size-3.5 shrink-0 border-2", bossRing)}
            />
            <span className="text-foreground/85">王</span>
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}

/* ── 目標表格 ── */

/** 本步驟目標：編號 / 名稱 / 等級 / 血量 / 防禦 / 護勁 / 要求命中；列與地圖標記互相高亮。 */
export function StepTargets() {
  const s = useStep();
  const { data } = s;
  if (data.groups.length === 0) return null;
  const top = data.hit?.dodge;

  return (
    <div className="my-5">
      {data.hit && (
        <p className="mb-2.5 flex items-center gap-2 text-[14.5px]">
          <CrosshairIcon className="size-4 shrink-0 text-(--stop-ink)" aria-hidden />
          <span>
            本步驟要求命中：
            <b className="font-semibold text-(--stop-ink)">
              ＞{fmt(data.hit.dodge)}（{data.hit.names.join("、")}）
            </b>
          </span>
        </p>
      )}
      <div className="bg-card overflow-hidden rounded-xl border">
        <Table className="min-w-[700px]">
          <TableHeader className="bg-muted/60 [&_th]:font-heading">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14 pl-3">編號</TableHead>
              <TableHead>目標</TableHead>
              <TableHead className="text-right">等級</TableHead>
              <TableHead className="text-right">血量</TableHead>
              <TableHead className="text-right">防禦</TableHead>
              <TableHead className="text-right">護勁</TableHead>
              <TableHead className="pr-4 text-right">要求命中</TableHead>
              <TableHead>卸冑</TableHead>
              <TableHead className="pr-4">中毒</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.groups.flatMap((g) => {
              const on = lit(s) === g.key;
              const onMap = g.map && g.points.length > 0;
              return g.rows.map((r, j) => (
                <TableRow
                  key={`${g.key}-${r.id}`}
                  data-group={g.key}
                  data-active={on || undefined}
                  onMouseEnter={() => s.setHover(g.key)}
                  onMouseLeave={() => s.setHover(null)}
                  onClick={() => s.setActive(toggle(s.active, g.key))}
                  style={mk(g.color)}
                  className="cursor-pointer data-[active]:bg-(--mk)/10 motion-safe:transition-colors"
                >
                  <TableCell className="pl-2">
                    {j === 0 && (
                      <button
                        type="button"
                        disabled={!onMap}
                        aria-pressed={s.active === g.key}
                        aria-label={`在地圖上標出 ${g.color} 號`}
                        onClick={(e) => {
                          e.stopPropagation();
                          s.setActive(toggle(s.active, g.key));
                        }}
                        onFocus={() => s.setHover(g.key)}
                        onBlur={() => s.setHover(null)}
                        className="grid size-8 place-items-center rounded-full outline-hidden focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-default"
                      >
                        <span
                          className={cn(
                            "grid size-[22px] place-items-center rounded-full bg-(--mk) text-[11px] font-bold text-white tabular-nums motion-safe:transition-shadow",
                            on && "shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--mk)]",
                          )}
                        >
                          {g.color}
                        </span>
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <EntityPortrait image={r.image} alt={r.name} size="sm" className="size-8" />
                      <Link
                        href={`/monsters/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {r.name}
                      </Link>
                      {g.tag && (
                        <Badge variant="outline" className="font-normal">
                          {g.tag}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">Lv {r.level}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.hp)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.def)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(r.mdef)}</TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 text-right font-mono tabular-nums",
                      r.dodge != null && r.dodge === top && "font-semibold text-(--stop-ink)",
                    )}
                  >
                    {r.dodge == null ? "—" : `＞${fmt(r.dodge)}`}
                  </TableCell>
                  <TableCell>{formatStatusResistance(r.weakenRes)}</TableCell>
                  <TableCell className="pr-4">{formatStatusResistance(r.bleedRes)}</TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[12.5px]">
        <InfoIcon className="size-3.5 shrink-0" aria-hidden />
        <span>
          要求命中＝玩家命中需大於怪物閃躲。卸冑＝百針滲血、千瘡百孔；中毒＝百八蟲毒。依怪物抗性推算，待實機驗證。
        </span>
      </p>
    </div>
  );
}

/* ── 九宮格 ── */

/** 九宮格房名對照（排列同解題工具）；點格子會在地圖上標出同名房間。children 放規則說明。 */
export function NineRoomGrid({
  tool = "/tools/160",
  children,
}: {
  tool?: string;
  children?: ReactNode;
}) {
  const s = useStep();
  return (
    <div className="my-6 grid items-start gap-x-8 gap-y-5 min-[600px]:grid-cols-[264px_minmax(0,1fr)]">
      <div>
        <p className="font-heading mb-2 text-[15px] font-medium">房名對照</p>
        <div role="group" aria-label="九宮格房名" className="grid grid-cols-3 gap-1.5">
          {GRID_LAYOUT.map((r) => {
            const on = s.room === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                data-cell={r}
                onClick={() => s.setRoom(toggle(s.room, r))}
                className={cn(
                  "font-heading grid h-16 place-items-center rounded-lg border text-[22px] font-semibold outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors",
                  on
                    ? "border-(--stop) bg-(--stop) text-background"
                    : "bg-card hover:bg-muted/60 border-border",
                  !on && r === "帝" && "border-(--stop)/60 text-(--stop-ink)",
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-[12.5px] leading-relaxed">
          排列和解題工具相同。點一格，地圖上同名的房間會亮起來。
        </p>
        <Link
          href={tool}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "mt-3 h-9 w-full text-(--stop-ink)",
          )}
        >
          打開九宮格解題工具
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
      <div className="min-w-0 [&>:first-child]:mt-0">{children}</div>
    </div>
  );
}
