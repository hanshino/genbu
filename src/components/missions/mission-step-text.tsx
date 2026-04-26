import Link from "next/link";
import type React from "react";
import type { MissionItemRef } from "@/lib/types/mission";

// MISSION.INI 的步驟文本內嵌兩種標籤：
//   <map=ID,x=X,y=Y,NPCID=N,LABEL[,map=ID2,...]>   (一個 tag 可包多組地圖)
//   <item,ID,QTY>                                   (QTY 偶爾省略)
// 渲染策略：地圖 tag 取第一組 LABEL 顯示為純文字；item tag 換成連到該 item
// 詳情頁的連結，並附上數量。
const TAG_PATTERN = "<map=[^>]+>|<item,(\\d+)(?:,(\\d+))?>";

function firstMapLabel(tag: string): string {
  // tag = "<map=...>"，去掉前 "<map=" 與後 ">"。
  const inner = tag.slice(5, -1);
  const first = inner.split(",map=")[0];
  const parts = first.split(",");
  return parts[parts.length - 1] ?? "";
}

interface Props {
  rawText: string;
  /** itemId → 物品名（含 qty 細節）。查不到時 fallback 到 `#id`。 */
  itemsLookup: Map<number, MissionItemRef>;
}

export function MissionStepText({ rawText, itemsLookup }: Props) {
  // 每次重建 RegExp 以避免共享 lastIndex 帶來的可變狀態。
  const tagRe = new RegExp(TAG_PATTERN, "g");
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(rawText)) !== null) {
    if (cursor < m.index) {
      nodes.push(rawText.slice(cursor, m.index));
    }
    if (m[0].startsWith("<map=")) {
      nodes.push(
        <span key={key++} className="font-medium">
          {firstMapLabel(m[0])}
        </span>,
      );
    } else {
      const itemId = parseInt(m[1], 10);
      const qty = m[2] ? parseInt(m[2], 10) : null;
      const name = itemsLookup.get(itemId)?.name ?? `#${itemId}`;
      nodes.push(
        <Link
          key={key++}
          href={`/items/${itemId}`}
          className="font-medium underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          {name}
          {qty != null && (
            <span className="ml-0.5 font-mono text-xs text-muted-foreground">×{qty}</span>
          )}
        </Link>,
      );
    }
    cursor = m.index + m[0].length;
  }
  if (cursor < rawText.length) nodes.push(rawText.slice(cursor));

  return <>{nodes}</>;
}
