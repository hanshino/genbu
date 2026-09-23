// 遊戲對話文字（messages.msg）的標記解析。
//
// 全庫只出現一種標記：`<FONT COLOR=RRGGBB>…</FONT>`，但品質參差：
//   - 有沒關的開標籤、多出來的 </FONT>、巢狀（開了又開）
//   - 缺 `>` 的開標籤：`<FONT COLOR=F88900（莊主…`
//   - 7 碼色碼（0070000）與罕見近似色（007001、F88903、008000、FF66FF）
// 換行有兩種寫法：字面 `\n`（兩個字元），或一長串全形空白（遊戲對話框定寬排版）。

/** 語意分組：顏色在遊戲裡代表的用途，而不是顏色本身。 */
export type GameTextTone =
  | "highlight" // 007000 綠：物品、NPC、關鍵字
  | "narration" // F88900 橘：括號內旁白、心聲、提示
  | "important" // F80000 紅：重要事項、警告、地點
  | "info" // 0000F8 藍：補充說明
  | "emphasis"; // 色碼無法解析，只做一般強調

export type GameTextToken = { type: "text"; text: string; tone: GameTextTone | null } | { type: "br" };

/** 四個基準色；罕見色碼依 RGB 距離歸到最近的一組。 */
const ANCHORS: Array<[GameTextTone, [number, number, number]]> = [
  ["highlight", [0x00, 0x70, 0x00]],
  ["narration", [0xf8, 0x89, 0x00]],
  ["important", [0xf8, 0x00, 0x00]],
  ["info", [0x00, 0x00, 0xf8]],
];

export function toneOfColor(code: string): GameTextTone {
  // 7 碼（0070000）取前 6 碼；不足 6 碼視為無法解析。
  const hex = code.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "emphasis";
  const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let best: GameTextTone = "emphasis";
  let bestDist = Infinity;
  for (const [tone, a] of ANCHORS) {
    const d = (rgb[0] - a[0]) ** 2 + (rgb[1] - a[1]) ** 2 + (rgb[2] - a[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = tone;
    }
  }
  return best;
}

// 開標籤的 `>` 可省略（見檔頭）；色碼吃 1–8 個 hex，交給 toneOfColor 判斷。
// 換行：字面 \n、真正的換行、2 個以上全形空白、4 個以上一般空白。
const TOKEN_RE = /<FONT\s+COLOR\s*=\s*#?([0-9a-f]{1,8})\s*>?|<\/FONT\s*>|\\n|\r?\n|\u3000{2,}|[ \t]{4,}/gi;

export function tokenizeGameText(raw: string): GameTextToken[] {
  const tokens: GameTextToken[] = [];
  // 巢狀時用堆疊：內層 </FONT> 關掉後回到外層顏色；多出來的 </FONT> 直接忽略。
  const stack: GameTextTone[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const tone = stack.at(-1) ?? null;
    const last = tokens.at(-1);
    if (last?.type === "text" && last.tone === tone) last.text += text;
    else tokens.push({ type: "text", text, tone });
  };
  const pushBr = () => {
    // 開頭不換行、連續換行只留一個（全形空白串常和 \n 疊在一起）
    if (tokens.length > 0 && tokens.at(-1)!.type !== "br") tokens.push({ type: "br" });
  };

  let cursor = 0;
  for (const m of raw.matchAll(TOKEN_RE)) {
    pushText(raw.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    const tag = m[0];
    if (m[1] !== undefined) stack.push(toneOfColor(m[1]));
    else if (tag[0] === "<") stack.pop();
    else pushBr();
  }
  pushText(raw.slice(cursor));
  if (tokens.at(-1)?.type === "br") tokens.pop();
  return tokens;
}

/** 依「看得到的字數」截斷，不會切壞標記；有截斷時在最後補「…」。 */
export function truncateGameTokens(tokens: GameTextToken[], maxChars: number): GameTextToken[] {
  const out: GameTextToken[] = [];
  let left = maxChars;
  for (const t of tokens) {
    if (t.type === "br") {
      out.push(t);
      continue;
    }
    // Array.from 以 code point 計數，避免切到代理對
    const chars = Array.from(t.text);
    if (chars.length <= left) {
      out.push(t);
      left -= chars.length;
      continue;
    }
    out.push({ ...t, text: `${chars.slice(0, left).join("")}…` });
    return out;
  }
  return out;
}

/** 去掉標記後的純文字（換行以 \n 表示）；給測試、meta、比對用。 */
export function gameTextPlain(raw: string): string {
  return tokenizeGameText(raw)
    .map((t) => (t.type === "br" ? "\n" : t.text))
    .join("");
}
