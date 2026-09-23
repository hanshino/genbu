import { describe, expect, it } from "vitest";
import { gameTextPlain, toneOfColor, tokenizeGameText, truncateGameTokens } from "../game-text";

describe("tokenizeGameText", () => {
  it("一般色碼與字面 \\n", () => {
    expect(tokenizeGameText("請清除<FONT COLOR=007000>碧絲蛇</FONT>，\\n只有<FONT COLOR=F80000>五分鐘</FONT>。")).toEqual([
      { type: "text", text: "請清除", tone: null },
      { type: "text", text: "碧絲蛇", tone: "highlight" },
      { type: "text", text: "，", tone: null },
      { type: "br" },
      { type: "text", text: "只有", tone: null },
      { type: "text", text: "五分鐘", tone: "important" },
      { type: "text", text: "。", tone: null },
    ]);
  });

  it("開標籤缺 `>`（msg 98305）仍能解析，文字不被吃掉", () => {
    const tokens = tokenizeGameText("<FONT COLOR=F88900（莊主終於回書房了……）\\n（夫人說過）</FONT>");
    expect(tokens).toEqual([
      { type: "text", text: "（莊主終於回書房了……）", tone: "narration" },
      { type: "br" },
      { type: "text", text: "（夫人說過）", tone: "narration" },
    ]);
  });

  it("巢狀回到外層顏色、未關閉延續到結尾、多餘 </FONT> 忽略", () => {
    expect(tokenizeGameText("<FONT COLOR=F88900>（最怕<FONT COLOR=007000>獨孤嫵</FONT>那ㄚ頭）</FONT>")).toEqual([
      { type: "text", text: "（最怕", tone: "narration" },
      { type: "text", text: "獨孤嫵", tone: "highlight" },
      { type: "text", text: "那ㄚ頭）", tone: "narration" },
    ]);
    expect(tokenizeGameText("你是師兄</FONT>派來的<FONT COLOR=F88900>（嗯")).toEqual([
      { type: "text", text: "你是師兄派來的", tone: null },
      { type: "text", text: "（嗯", tone: "narration" },
    ]);
  });

  it("罕見色碼歸到最近語意；無法解析者為 emphasis", () => {
    expect(toneOfColor("0070000")).toBe("highlight");
    expect(toneOfColor("007003")).toBe("highlight");
    expect(toneOfColor("008000")).toBe("highlight");
    expect(toneOfColor("F88903")).toBe("narration");
    expect(toneOfColor("0000F8")).toBe("info");
    expect(toneOfColor("FFF")).toBe("emphasis");
    expect(tokenizeGameText("<FONT COLOR=ABC>x</FONT>")).toEqual([{ type: "text", text: "x", tone: "emphasis" }]);
  });

  it("全形空白串當換行，頭尾與連續換行收斂", () => {
    expect(gameTextPlain("　　　好。　　　　\\n是！　　")).toBe("好。\n是！");
  });
});

describe("truncateGameTokens", () => {
  it("依看得到的字數截斷，不切壞標記", () => {
    const tokens = tokenizeGameText("ab<FONT COLOR=007000>cdef</FONT>gh");
    expect(truncateGameTokens(tokens, 4)).toEqual([
      { type: "text", text: "ab", tone: null },
      { type: "text", text: "cd…", tone: "highlight" },
    ]);
    expect(truncateGameTokens(tokens, 99)).toEqual(tokens);
  });
});
