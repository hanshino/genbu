"use client";

import { useState, type MouseEvent } from "react";
import { effectiveProb, levelOf, waterIconId } from "@/lib/meridian-sim";
import type {
  MeridianChannel,
  MeridianData,
  MeridianLevels,
  MeridianPoint,
  MeridianStatFlag,
} from "@/lib/types/meridian";
import { cn } from "@/lib/utils";
import styles from "./meridian.module.css";
import { fmt, statValue } from "./format";

/* ---------- 640×480 客戶端座標（照 mockup 量測值） ---------- */
type Box = { x: number; y: number; w: number; h: number };

const GW_FIELDS: (Box & { stat: string | null })[] = [
  // 右上屬性區
  { x: 405, y: 43, w: 55, h: 14, stat: "HPMAX" },
  { x: 555, y: 43, w: 53, h: 14, stat: "MPMAX" },
  { x: 405, y: 60, w: 55, h: 14, stat: "HP" },
  { x: 555, y: 60, w: 53, h: 14, stat: "MP" },
  { x: 406, y: 77, w: 55, h: 14, stat: "HPRecover" },
  { x: 555, y: 77, w: 53, h: 14, stat: "MPRecover" },

  { x: 366, y: 105, w: 44, h: 14, stat: "Atk" },
  { x: 465, y: 105, w: 44, h: 14, stat: "Str" },
  { x: 565, y: 105, w: 44, h: 14, stat: "ExtraDef" },
  { x: 366, y: 123, w: 44, h: 13, stat: "MAtk" },
  { x: 465, y: 122, w: 44, h: 14, stat: "Pow" },
  { x: 565, y: 122, w: 44, h: 14, stat: "MagicDef" },
  { x: 366, y: 139, w: 44, h: 14, stat: "Dodge" },
  { x: 466, y: 139, w: 44, h: 14, stat: "Vit" },
  { x: 565, y: 139, w: 44, h: 14, stat: "FireDef" },
  { x: 366, y: 157, w: 44, h: 13, stat: "Hit" },
  { x: 466, y: 157, w: 44, h: 13, stat: "Agi" },
  { x: 565, y: 156, w: 44, h: 14, stat: "WaterDef" },
  { x: 366, y: 173, w: 44, h: 14, stat: "Critical" },
  { x: 466, y: 173, w: 44, h: 14, stat: "Dex" },
  { x: 565, y: 173, w: 44, h: 14, stat: "LightningDef" },
  { x: 366, y: 191, w: 44, h: 13, stat: null },
  { x: 466, y: 190, w: 44, h: 14, stat: "Wis" },
  { x: 565, y: 190, w: 44, h: 14, stat: "EarthDef" },

  { x: 432, y: 218, w: 44, h: 14, stat: "EnemyDef" },
  { x: 565, y: 218, w: 44, h: 14, stat: "WeakenRes" },
  { x: 432, y: 235, w: 44, h: 13, stat: "EnemyMDef" },
  { x: 565, y: 235, w: 44, h: 13, stat: "StunRes" },
  { x: 432, y: 253, w: 44, h: 13, stat: "Hurt" },
  { x: 565, y: 253, w: 44, h: 13, stat: "ShapeRes" },
  { x: 432, y: 270, w: 44, h: 14, stat: "AtribChanlProb" },
  { x: 565, y: 270, w: 44, h: 14, stat: "BleedRes" },
  { x: 432, y: 287, w: 44, h: 14, stat: "AtribChanlExp" },
  { x: 565, y: 287, w: 44, h: 14, stat: "Encumbrance" },
];
const GW_SLOTS = {
  name: { x: 338, y: 339, w: 120, h: 13 },
  desc: { x: 336, y: 359, w: 134, h: 14 },
  req: [
    { x: 335, y: 398, w: 64, h: 14 },
    { x: 407, y: 398, w: 63, h: 14 },
    { x: 335, y: 416, w: 64, h: 14 },
    { x: 407, y: 416, w: 63, h: 14 },
  ],
  cost: { x: 389, y: 440, w: 81, h: 13 },
  prob: { x: 543, y: 440, w: 42, h: 13 },
  level: { x: 53, y: 452, w: 38, h: 13 },
  exp: { x: 140, y: 452, w: 62, h: 13 },
  dantian: { x: 239, y: 452, w: 38, h: 13 },
};
const GW_TABS: Box[] = [
  { x: 48, y: 38, w: 39, h: 23 },
  { x: 109, y: 38, w: 39, h: 23 },
  { x: 170, y: 38, w: 38, h: 24 },
  { x: 229, y: 38, w: 39, h: 23 },
];
const GW_WATER = { x: 226, y: 70, w: 83, h: 79 };
const GW_LEVELUP = { x: 483, y: 352, w: 128, h: 36 };
/** 左側人形區：最近點判定的範圍 */
const HIT_BOX = { x: 66, y: 86, w: 166, h: 326 };

const px = (n: number) => `calc(var(--px) * ${n})`;
const place = (b: Box) => ({ left: px(b.x), top: px(b.y), width: px(b.w), height: px(b.h) });

export type Fx = { kind: "pop" | "miss"; id: number; n: number } | null;

interface Props {
  images: MeridianData["images"];
  channels: MeridianChannel[];
  channel: MeridianChannel;
  /** 當前脈的穴位 */
  points: MeridianPoint[];
  idx: Map<number, MeridianPoint>;
  levels: MeridianLevels;
  selected: MeridianPoint;
  totals: Map<string, { value: number; flag: MeridianStatFlag }>;
  bonus: number;
  qi: number;
  expText: string;
  dantianText: string;
  /** 體驗模式的剩餘丹田；規劃模式為 null（不判斷夠不夠） */
  dantian: number | null;
  canBreak: boolean;
  fx: Fx;
  onFxEnd: () => void;
  toast: { msg: string; show: boolean };
  onSelect: (id: number) => void;
  onChannel: (no: number) => void;
}

export function GameWindow(props: Props) {
  const {
    images,
    channels,
    channel,
    points,
    idx,
    levels,
    selected,
    totals,
    bonus,
    qi,
    expText,
    dantianText,
    dantian,
    canBreak,
    fx,
    onFxEnd,
    toast,
    onSelect,
    onChannel,
  } = props;
  const [nearId, setNearId] = useState<number | null>(null);

  const nearest = (ev: MouseEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const gx = HIT_BOX.x + ((ev.clientX - r.left) / r.width) * HIT_BOX.w;
    const gy = HIT_BOX.y + ((ev.clientY - r.top) / r.height) * HIT_BOX.h;
    let best: MeridianPoint | null = null;
    let bd = Infinity;
    for (const p of points) {
      const d = (p.btnX + 5 - gx) ** 2 + (p.btnY + 5 - gy) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };

  const img = (key: string) => images[key];
  const frame = img("1284:normal:0");
  const light = img("1291:normal:0");
  const water = img(`${waterIconId(qi)}:normal:0`);
  const levelUp = img(`1292:${canBreak ? "normal" : "disable"}:0`);
  const sil = channel.baseImage;

  // 下方詳細欄
  const L = levelOf(levels, selected.id);
  const next = L + 1;
  const maxed = next > selected.maxLevel;
  const nextLv = maxed ? null : selected.levels[next - 1];
  const reqs = nextLv?.prereqs ?? [];

  return (
    <div className={cn(styles.gw, "rounded-xl border border-border/60 shadow-sm")}>
      {/* eslint-disable @next/next/no-img-element -- 遊戲原圖走外部 CDN，需要 pixelated 與絕對定位 */}
      <div className={styles.inner}>
        {frame && (
          <img src={frame.url} alt="" style={{ left: 0, top: 0, width: "100%", height: "100%" }} />
        )}
        <img
          src={sil.url}
          alt={`${channel.name}經脈圖`}
          style={{
            left: px(channel.baseX),
            top: px(channel.baseY),
            width: px(sil.width),
            height: px(sil.height),
          }}
        />

        {/* 只渲染當前脈的亮燈，切脈時別脈不會殘留 */}
        {light &&
          points.map((p) => {
            if (levelOf(levels, p.id) <= 0) return null;
            const popping = fx?.kind === "pop" && fx.id === p.id;
            return (
              <img
                key={popping ? `${p.id}-${fx.n}` : p.id}
                src={light.url}
                alt=""
                className={cn(
                  styles.light,
                  popping ? styles.pop : p.id === selected.id && styles.blink,
                )}
                style={{ left: px(p.btnX - 19), top: px(p.btnY - 22) }}
                onAnimationEnd={popping ? onFxEnd : undefined}
              />
            );
          })}

        {channels.map((c, i) => (
          <button
            key={c.channelNo}
            type="button"
            className={styles.tab}
            style={place(GW_TABS[i])}
            aria-label={c.name}
            title={c.name}
            aria-pressed={c.channelNo === channel.channelNo}
            onClick={() => onChannel(c.channelNo)}
          >
            <img src={c.tabImage.url} alt="" />
          </button>
        ))}

        {points.map((p) => {
          const missing = fx?.kind === "miss" && fx.id === p.id;
          return (
            <span
              key={missing ? `${p.id}-${fx.n}` : p.id}
              aria-hidden
              className={cn(styles.spot, missing && styles.miss)}
              data-selected={p.id === selected.id || undefined}
              data-near={p.id === nearId || undefined}
              style={{ left: px(p.btnX + 5), top: px(p.btnY + 5) }}
              onAnimationEnd={missing ? onFxEnd : undefined}
            />
          );
        })}

        {/* 最近點熱區：手機上不必精準戳到小圓點 */}
        <div
          role="presentation"
          className={styles.hit}
          style={place(HIT_BOX)}
          onClick={(e) => {
            const p = nearest(e);
            if (p) onSelect(p.id);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === "touch") return;
            setNearId(nearest(e)?.id ?? null);
          }}
          onPointerLeave={() => setNearId(null)}
        />

        {water && <img src={water.url} alt={`氣海 ${qi} / 100`} style={place(GW_WATER)} />}

        {/* 右半欄位 */}
        {GW_FIELDS.map((b, i) => {
          const t = b.stat ? totals.get(b.stat) : undefined;
          return (
            <div key={i} className={cn(styles.f, styles.r, !t && styles.dim)} style={place(b)}>
              {t && b.stat ? statValue(b.stat, t.value, t.flag) : ""}
            </div>
          );
        })}
        <div className={cn(styles.f, styles.c)} style={place(GW_SLOTS.name)}>
          {selected.name}（{L} / {selected.maxLevel}）
        </div>
        <div className={cn(styles.f, styles.c)} style={place(GW_SLOTS.desc)}>
          {maxed ? "已滿級" : (nextLv?.help ?? "")}
        </div>
        {GW_SLOTS.req.map((b, i) => {
          const r = reqs[i];
          const ok = r && levelOf(levels, r.id) >= r.level;
          return (
            <div
              key={i}
              className={cn(styles.f, styles.c, r && (ok ? styles.good : styles.bad))}
              style={place(b)}
            >
              {r ? `${idx.get(r.id)?.name ?? r.id} ${r.level}` : ""}
            </div>
          );
        })}
        <div
          className={cn(
            styles.f,
            styles.c,
            maxed && styles.dim,
            !maxed && dantian != null && (nextLv?.cost ?? 0) > dantian && styles.bad,
          )}
          style={place(GW_SLOTS.cost)}
        >
          {maxed ? "—" : nextLv?.cost != null ? fmt(nextLv.cost) : "任務"}
        </div>
        <div className={cn(styles.f, styles.c, maxed && styles.dim)} style={place(GW_SLOTS.prob)}>
          {maxed || !nextLv ? "—" : `${effectiveProb(nextLv.prob, bonus)}%`}
        </div>
        <div className={cn(styles.f, styles.c, styles.dim)} style={place(GW_SLOTS.level)}>
          —
        </div>
        <div className={cn(styles.f, styles.c)} style={place(GW_SLOTS.exp)}>
          {expText}
        </div>
        <div className={cn(styles.f, styles.c)} style={place(GW_SLOTS.dantian)}>
          {dantianText}
        </div>

        {/* 打通按鈕圖：純裝飾，實際按鈕在資訊欄 */}
        {levelUp && <img src={levelUp.url} alt="" style={place(GW_LEVELUP)} />}

        <div
          className={styles.toast}
          role="status"
          aria-live="polite"
          data-show={toast.show || undefined}
        >
          {toast.msg}
        </div>
      </div>
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}
