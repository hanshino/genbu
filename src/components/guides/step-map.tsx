"use client";

import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  CrosshairIcon,
  InfoIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "lucide-react";
import {
  cropFrame,
  fullFrameBox,
  toPercent,
  type Point,
  type StepData,
  type StepGroup,
  type StepMark,
} from "@/lib/guide-steps";
import { GRID_LAYOUT } from "@/lib/solvers/forest-matrix";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  return (
    <StepContext.Provider value={{ data, active, setActive, hover, setHover, room, setRoom }}>
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
        className={cn(hit, "z-[3] cursor-pointer motion-safe:transition-[scale] hover:scale-110", on && "z-[5] scale-125")}
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

function Legend({ data }: { data: StepData }) {
  const marks = data.marks.filter((m) => m.as !== "room");
  const numbered = data.groups.some((g) => g.map && g.points.length > 0 && g.as !== "area");
  if (marks.length === 0 && !numbered) return null;
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2.5 text-[12.5px] leading-relaxed">
      {marks.map((m) => (
        <li key={m.key} className="inline-flex items-center gap-1.5">
          {m.as === "npc" && <span className="size-2.5 rotate-45 rounded-[2px] bg-(--stop)" aria-hidden />}
          {m.as === "device" && <span className="bg-foreground/85 h-2.5 w-3.5 rounded-[2px]" aria-hidden />}
          {m.as === "ok" && <CheckIcon className="size-3.5 text-(--marker-3)" strokeWidth={3} aria-hidden />}
          <span className="text-foreground/85">{m.label && m.as !== "ok" ? `${m.label}・${m.name}` : m.name}</span>
          {m.as === "ok" && <span>＝已完成，不可攻擊</span>}
          {(m.tbd || m.points.length === 0) && <span>（位置待確認）</span>}
        </li>
      ))}
      {numbered && <li>圓點編號對應下方表格，滑過或點一下可以對照。</li>}
    </ul>
  );
}

/** 地圖：預設只看本區塊，可切到完整地圖（會框出本區塊）。沒有地圖圖檔時不顯示。 */
export function StepMap({ alt }: { alt?: string }) {
  const s = useStep();
  const { data } = s;
  const [full, setFull] = useState(false);
  const img = data.image;
  if (!img) return null;

  const crop = data.crop;
  const showCrop = crop != null && !full;
  const label = alt ?? `${data.stageName}地圖`;

  return (
    <figure className="bg-card my-5 overflow-hidden rounded-xl border">
      {showCrop ? (
        <CropView data={data} alt={`${label}（本區塊）`} />
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
            {crop && (
              <span
                data-testid="step-frame"
                style={(() => {
                  const b = fullFrameBox(img, crop);
                  return { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` };
                })()}
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-(--stop) bg-(--stop)/8 shadow-[0_0_0_9999px_rgb(0_0_0/0.18)]"
              >
                <b className="absolute -top-px left-2 -translate-y-full rounded-t-md bg-(--stop) px-2 py-0.5 text-[11.5px] font-semibold text-white">
                  本區塊
                </b>
              </span>
            )}
            <Layer data={data} crop={null} />
          </div>
        </div>
      )}

      <figcaption className="border-t">
        <Legend data={data} />
        {crop && (
          <div className="flex items-center justify-between gap-3 border-t border-dashed px-3 py-2">
            <span className="text-muted-foreground text-[12px] sm:invisible">
              {full ? "地圖可左右滑動" : ""}
            </span>
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
          </div>
        )}
      </figcaption>
    </figure>
  );
}

function CropView({ data, alt }: { data: StepData; alt: string }) {
  const img = data.image!;
  const f = cropFrame(img, data.crop!);
  return (
    <div className="bg-muted/40 relative w-full overflow-hidden" style={{ aspectRatio: String(f.aspect) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 與地圖頁一致，直連圖床 */}
      <img
        src={img.url}
        alt={alt}
        loading="lazy"
        draggable={false}
        style={{ width: `${f.width}%`, left: `${f.left}%`, top: `${f.top}%` }}
        className="absolute h-auto max-w-none select-none"
      />
      <Layer data={data} crop={data.crop} />
    </div>
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
        <Table className="min-w-[560px]">
          <TableHeader className="bg-muted/60 [&_th]:font-heading">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14 pl-3">編號</TableHead>
              <TableHead>目標</TableHead>
              <TableHead className="text-right">等級</TableHead>
              <TableHead className="text-right">血量</TableHead>
              <TableHead className="text-right">防禦</TableHead>
              <TableHead className="text-right">護勁</TableHead>
              <TableHead className="pr-4 text-right">要求命中</TableHead>
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
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[12.5px]">
        <InfoIcon className="size-3.5 shrink-0" aria-hidden />
        要求命中＝玩家命中需大於怪物閃躲
      </p>
    </div>
  );
}

/* ── 九宮格 ── */

/** 九宮格房名對照（排列同解題工具）；點格子會在地圖上標出同名房間。children 放規則說明。 */
export function NineRoomGrid({ tool = "/tools/160", children }: { tool?: string; children?: ReactNode }) {
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
          className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-9 w-full text-(--stop-ink)")}
        >
          打開九宮格解題工具
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
      <div className="min-w-0 [&>:first-child]:mt-0">{children}</div>
    </div>
  );
}
