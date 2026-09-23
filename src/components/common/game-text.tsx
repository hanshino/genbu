import { Fragment } from "react";
import {
  tokenizeGameText,
  truncateGameTokens,
  type GameTextTone,
} from "@/lib/format/game-text";

/**
 * 遊戲色碼 → 站內語意色（沿用主題 token，亮/暗主題各自成立）：
 * - highlight 綠 → 青瓷 chart-2；亮色主題混入墨色壓深，確保宣紙底上讀得清楚
 * - narration 橘 → 淡墨 muted-foreground：心聲、旁白本來就是「退一步」的語氣
 * - important 紅 → 朱砂 primary
 * - info 藍 → 靛青 chart-3
 */
const TONE_CLASS: Record<GameTextTone, string> = {
  highlight:
    "font-medium text-[color-mix(in_oklch,var(--color-chart-2)_70%,var(--color-foreground))] dark:text-chart-2",
  narration: "text-muted-foreground",
  important: "font-medium text-primary",
  info: "text-chart-3",
  emphasis: "font-medium",
};

interface GameTextProps {
  /** messages.msg 原文（含 FONT 標記與字面 \n）。 */
  text: string;
  /** 依看得到的字數截斷（標記不算字）。 */
  maxChars?: number;
  className?: string;
}

/** 遊戲對話文字：解析 FONT 色碼與換行，不用 dangerouslySetInnerHTML。 */
export function GameText({ text, maxChars, className }: GameTextProps) {
  let tokens = tokenizeGameText(text);
  if (maxChars != null) tokens = truncateGameTokens(tokens, maxChars);
  return (
    <span className={className}>
      {tokens.map((t, i) =>
        t.type === "br" ? (
          <br key={i} />
        ) : t.tone ? (
          <span key={i} className={TONE_CLASS[t.tone]}>
            {t.text}
          </span>
        ) : (
          <Fragment key={i}>{t.text}</Fragment>
        ),
      )}
    </span>
  );
}
