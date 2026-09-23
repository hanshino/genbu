import { ImageResponse } from "next/og";
import { getItemById } from "@/lib/queries/items";
import { getItemIcon } from "@/lib/queries/images";
import { imageOfItem } from "@/lib/equipment-images";
import { displayableAttributeKeys, itemAttributeNames } from "@/lib/constants/i18n";
import { ITEM_TYPE_LABELS } from "@/lib/constants/item-types";

export const alt = "玄武 · 武林同萌傳資料庫 道具預覽";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 資料每次部署才變：第一次被請求時產生，之後一直用快取（不在 build 時預產 1.3 萬張）。
export const revalidate = false;
export async function generateStaticParams() {
  return [];
}

// globals.css 的宣紙 / 墨 / 朱砂色票換算成 hex（satori 不吃 oklch）
const C = {
  bg: "#f9f6f1",
  card: "#fcfaf6",
  ink: "#171b22",
  muted: "#585e68",
  secondary: "#ede9e1",
  border: "#dbd7cf",
  cinnabar: "#b6322d",
};

const BRAND = "玄武";
const SUBTITLE = "武林同萌傳資料庫";
const DOMAIN = "genbu.hanshino.dev";

const fetchOpts = () => ({ signal: AbortSignal.timeout(5000) });

// Google Fonts CSS2 帶 text= 只回傳用到的字，預設 UA 拿到的是 truetype（satori 不吃 woff2）。
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
      fetchOpts(),
    ).then((r) => r.text());
    const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, fetchOpts());
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// 先抓成 data URL：遠端圖掛了就退回 icon / 無圖，不讓 satori 自己抓到 throw。
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, fetchOpts());
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

type Art =
  | { kind: "cover"; src: string }
  | { kind: "icon"; src: string; w: number; h: number }
  | null;

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  const item = Number.isInteger(itemId) && itemId > 0 ? getItemById(itemId) : null;

  let art: Art = null;
  if (item) {
    const cover = imageOfItem(item);
    const coverSrc = cover && (await toDataUrl(cover.src));
    if (coverSrc) {
      art = { kind: "cover", src: coverSrc };
    } else {
      const icon = getItemIcon(item.id);
      const iconSrc = icon && (await toDataUrl(icon.url));
      if (icon && iconSrc) art = { kind: "icon", src: iconSrc, w: icon.width ?? 40, h: icon.height ?? 40 };
    }
  }

  const typeLabel = item?.type ? (ITEM_TYPE_LABELS[item.type] ?? null) : null;
  const note = item?.note && item.note.length <= 8 ? item.note : null;
  const stats = item
    ? displayableAttributeKeys
        .filter((k) => item[k] !== 0)
        .slice(0, 3) // 小尺寸縮圖只放得下一排
        .map((k) => ({ label: itemAttributeNames[k] ?? k, value: signed(item[k]) }))
    : [];
  const rawSummary = item?.summary?.replace(/[\\/]n/g, " ").trim() ?? "";
  const summary = stats.length === 0 && rawSummary ? (rawSummary.length > 46 ? `${rawSummary.slice(0, 45)}…` : rawSummary) : null;
  const level = item && item.level > 0 ? `等級 ${item.level}` : null;
  const name = item?.name ?? "道具不存在";

  const serifText = BRAND + name;
  const sansText =
    SUBTITLE + "·道具查詢裝備比較掉落來源" + [typeLabel, note, level, summary, ...stats.flatMap((s) => [s.label, s.value])].join("") + DOMAIN + "#0123456789";
  const [serif, sans, sansBold] = await Promise.all([
    loadFont("Noto Serif TC", 700, serifText),
    loadFont("Noto Sans TC", 400, sansText),
    loadFont("Noto Sans TC", 700, sansText),
  ]);

  // ponytail: 字型抓不到時只畫英文卡避免出現缺字方塊；這張也會被快取到下次部署，真的常失敗再改成打包字型檔。
  if (!serif || !sans || !sansBold) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: C.bg, color: C.ink }}>
          <div style={{ fontSize: 96, fontWeight: 700, color: C.cinnabar, letterSpacing: 12 }}>GENBU</div>
          <div style={{ fontSize: 36, color: C.muted, marginTop: 16 }}>{item ? `${DOMAIN}/items/${item.id}` : DOMAIN}</div>
        </div>
      ),
      size,
    );
  }

  const nameSize = name.length >= 7 ? 76 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: `radial-gradient(circle at 85% 20%, #fffdf8 0%, ${C.bg} 55%, #f1ece2 100%)`,
          color: C.ink,
          fontFamily: "Sans",
          position: "relative",
        }}
      >
        {/* 左緣朱砂直條 */}
        <div style={{ display: "flex", width: 16, height: "100%", background: C.cinnabar }} />
        {/* 內框細線，像裱框的宣紙 */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 24,
            left: 40,
            right: 24,
            bottom: 24,
            border: `2px solid ${C.border}`,
            borderRadius: 12,
          }}
        />

        <div style={{ display: "flex", flex: 1, padding: "64px 72px 60px 76px", gap: 44 }}>
          {/* 文字欄 */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: C.cinnabar,
                  color: C.bg,
                  fontFamily: "Serif",
                  fontSize: 36,
                }}
              >
                玄
              </div>
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: 36, color: C.cinnabar }}>{BRAND}</div>
              <div style={{ display: "flex", width: 2, height: 28, background: C.border }} />
              <div style={{ display: "flex", fontSize: 28, color: C.muted }}>{SUBTITLE}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: nameSize, lineHeight: 1.15, letterSpacing: 4 }}>
                {name}
              </div>

              {(typeLabel || note || level) && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, fontSize: 32 }}>
                  {typeLabel && (
                    <div
                      style={{
                        display: "flex",
                        padding: "6px 20px",
                        borderRadius: 8,
                        background: C.cinnabar,
                        color: C.bg,
                        fontWeight: 700,
                      }}
                    >
                      {typeLabel}
                    </div>
                  )}
                  {note && (
                    <div style={{ display: "flex", padding: "6px 20px", borderRadius: 8, background: C.secondary, border: `2px solid ${C.border}` }}>
                      {note}
                    </div>
                  )}
                  {level && <div style={{ display: "flex", color: C.muted }}>{level}</div>}
                </div>
              )}

              {stats.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 36 }}>
                  {stats.map((s) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        padding: "10px 16px",
                        borderRadius: 10,
                        background: C.card,
                        border: `2px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: 24, color: C.muted }}>{s.label}</span>
                      <span style={{ fontSize: 32, fontWeight: 700 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {summary && (
                <div style={{ display: "flex", marginTop: 32, fontSize: 30, lineHeight: 1.6, color: C.muted }}>{summary}</div>
              )}

              {!item && (
                <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: C.muted }}>道具查詢 · 裝備比較 · 掉落來源</div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: C.muted }}>
              <span>{DOMAIN}</span>
              {item && <span style={{ color: C.border }}>·</span>}
              {item && <span>#{item.id}</span>}
            </div>
          </div>

          {/* 圖欄 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              width: 400,
              height: 400,
              flexShrink: 0,
              borderRadius: 16,
              background: C.card,
              border: `2px solid ${C.border}`,
              boxShadow: "0 18px 40px rgba(23,27,34,0.12)",
              overflow: "hidden",
            }}
          >
            {art?.kind === "cover" ? (
              <img src={art.src} alt="" width={376} height={376} style={{ objectFit: "contain" }} />
            ) : art?.kind === "icon" ? (
              // satori 會把 <img> 平滑放大；包進 SVG 用 optimizeSpeed 讓 resvg 走最近鄰，像素圖才銳利
              <svg
                width={art.w * Math.floor(300 / Math.max(art.w, art.h))}
                height={art.h * Math.floor(300 / Math.max(art.w, art.h))}
                viewBox={`0 0 ${art.w} ${art.h}`}
              >
                <image href={art.src} width={art.w} height={art.h} imageRendering="optimizeSpeed" />
              </svg>
            ) : (
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: 220, color: item ? C.border : C.cinnabar }}>
                {item ? name.slice(0, 1) : "玄"}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Serif", data: serif, weight: 700, style: "normal" },
        { name: "Sans", data: sans, weight: 400, style: "normal" },
        { name: "Sans", data: sansBold, weight: 700, style: "normal" },
      ],
    },
  );
}
