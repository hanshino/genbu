// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  START_POINTS,
  birthdayProblem,
  nameBytes,
  nameProblem,
  normalizeName,
  parseBirthdayInput,
  parseNewCharacter,
  startAttributes,
  startAttributesProblem,
} from "../creation";

describe("nameBytes", () => {
  it("ASCII 算 1、其他字元算 2", () => {
    expect(nameBytes("abc")).toBe(3);
    expect(nameBytes("江湖")).toBe(4);
    expect(nameBytes("a江b")).toBe(4);
    expect(nameBytes("")).toBe(0);
  });
});

describe("nameProblem", () => {
  it.each(["江湖", "Hanshino", "小A", "a b", "劍氣縱橫", "ＡＢ"])("接受 %s", (name) => {
    expect(nameProblem(name)).toBeNull();
  });

  it("長度剛好 15 位元組可以，16 就太長", () => {
    expect(nameProblem("a".repeat(15))).toBeNull();
    expect(nameProblem("江".repeat(7) + "a")).toBeNull(); // 7*2 + 1
    expect(nameProblem("a".repeat(16))).toBe("名字最長 15 位元組（英數字算 1、中文字算 2），目前 16。");
    expect(nameProblem("江".repeat(8))).toContain("目前 16");
  });

  it("空白與純空白都不行（呼叫端先 normalizeName）", () => {
    expect(nameProblem(normalizeName(""))).toBe("請輸入名字。");
    expect(nameProblem(normalizeName("   "))).toBe("請輸入名字。");
    expect(normalizeName("  江湖 ")).toBe("江湖");
  });

  it.each([..."~!@#$%^&*()=+|?/,'{}\"\\;"])("拒絕符號 %s", (ch) => {
    expect(nameProblem(`a${ch}b`)).toBe(`名字不能包含「${ch}」。`);
  });

  it("沒列在禁用清單的符號可以用", () => {
    expect(nameProblem("a-b_c.d")).toBeNull();
    expect(nameProblem("a<b>[c]")).toBeNull();
  });

  it.each(["GM", "gm", "Gm小", "小gM", "xGMx", "ＧＭ"])("不能包含 GM（不分大小寫）：%s", (name) => {
    expect(nameProblem(name)).toBe("名字不能包含「GM」。");
  });

  it("控制字元不行", () => {
    expect(nameProblem("a\nb")).toBe("名字不能包含控制字元。");
    expect(nameProblem("a\tb")).toBe("名字不能包含控制字元。");
  });

  it("Big5 沒有的字元不行（emoji、日文假名、簡體專用字）", () => {
    expect(nameProblem("劍😀")).toBe("遊戲不支援「😀」這個字元。");
    expect(nameProblem("あ")).toBe("遊戲不支援「あ」這個字元。");
    expect(nameProblem("爱")).toBe("遊戲不支援「爱」這個字元。");
  });

  it("先檢查符號與 GM，再檢查長度", () => {
    expect(nameProblem("GM" + "a".repeat(20))).toBe("名字不能包含「GM」。");
  });
});

describe("生日", () => {
  it("月 1–12、日要是該月有的日子（2/29 算有效，沒有年份）", () => {
    expect(birthdayProblem(1, 31)).toBeNull();
    expect(birthdayProblem(2, 29)).toBeNull();
    expect(birthdayProblem(12, 31)).toBeNull();
    expect(birthdayProblem(0, 1)).toBe("生日的月份要在 1 到 12 之間。");
    expect(birthdayProblem(13, 1)).toBe("生日的月份要在 1 到 12 之間。");
    expect(birthdayProblem(2, 30)).toBe("2 月沒有 30 日。");
    expect(birthdayProblem(4, 31)).toBe("4 月沒有 31 日。");
    expect(birthdayProblem(4, 0)).toBe("4 月沒有 0 日。");
    expect(birthdayProblem(1.5, 1)).not.toBeNull();
  });

  it("畫面輸入：兩格都空 = 不填；只填一格、非數字、不合法都有錯誤", () => {
    expect(parseBirthdayInput("", " ")).toEqual({ ok: true, birthday: null });
    expect(parseBirthdayInput("3", "14")).toEqual({ ok: true, birthday: { month: 3, day: 14 } });
    expect(parseBirthdayInput("3", "")).toEqual({ ok: false, error: "生日要同時填月和日，或兩格都留空。" });
    expect(parseBirthdayInput("x", "1")).toEqual({ ok: false, error: "生日請填數字。" });
    expect(parseBirthdayInput("2", "30")).toEqual({ ok: false, error: "2 月沒有 30 日。" });
  });
});

describe("startAttributesProblem", () => {
  const attrs = (over: Record<string, unknown> = {}) => ({ ...startAttributes(), ...over });

  it("全 1、用掉 6 點、不用點都可以", () => {
    expect(startAttributesProblem(attrs())).toBeNull();
    expect(startAttributesProblem(attrs({ str: 7 }))).toBeNull();
    expect(startAttributesProblem(attrs({ str: 3, dex: 3, wis: 3 }))).toBeNull();
  });

  it("超過可分配的點數、低於 1、非整數、缺欄位、多欄位都不行", () => {
    expect(startAttributesProblem(attrs({ str: 8 }))).toBe(`屬性點最多只能用 ${START_POINTS} 點。`);
    expect(startAttributesProblem(attrs({ str: 5, dex: 4 }))).toBe(`屬性點最多只能用 ${START_POINTS} 點。`);
    expect(startAttributesProblem(attrs({ str: 0 }))).toBe("屬性不能低於 1。");
    expect(startAttributesProblem(attrs({ str: -3, dex: 9 }))).toBe("屬性不能低於 1。");
    expect(startAttributesProblem(attrs({ str: 1.5 }))).toBe("屬性必須是整數。");
    expect(startAttributesProblem(attrs({ str: "2" }))).toBe("屬性必須是整數。");
    expect(startAttributesProblem({ str: 1 })).toBe("請提供六項屬性。");
    expect(startAttributesProblem(attrs({ luck: 1 }))).toBe("屬性名稱不正確。");
    expect(startAttributesProblem(null)).toBe("請提供六項屬性。");
    expect(startAttributesProblem([])).toBe("請提供六項屬性。");
  });
});

describe("parseNewCharacter", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    name: "江湖",
    gender: "m",
    attributes: { ...startAttributes(), str: 4 },
    ...over,
  });

  it("成功：名字去掉頭尾空白，剩餘點數 = 6 − 已用", () => {
    const res = parseNewCharacter(body({ name: "  江湖 ", birthday: { month: 2, day: 29 } }));
    expect(res).toEqual({
      ok: true,
      character: {
        name: "江湖",
        gender: "m",
        attributes: { str: 4, pow: 1, vit: 1, agi: 1, dex: 1, wis: 1 },
        birthday: { month: 2, day: 29 },
        unspentPoints: 3,
      },
    });
  });

  it("生日可以不給（沒有 birthday 欄位）", () => {
    const res = parseNewCharacter(body());
    expect(res.ok && "birthday" in res.character).toBe(false);
    expect(parseNewCharacter(body({ birthday: null })).ok).toBe(true);
  });

  it.each([
    [{ gender: "x" }, "請選擇性別。"],
    [{ gender: undefined }, "請選擇性別。"],
    [{ name: 5 }, "請輸入名字。"],
    [{ name: " " }, "請輸入名字。"],
    [{ name: "GM江" }, "名字不能包含「GM」。"],
    [{ attributes: { ...startAttributes(), str: 9 } }, `屬性點最多只能用 ${START_POINTS} 點。`],
    [{ birthday: { month: 13, day: 1 } }, "生日的月份要在 1 到 12 之間。"],
    [{ birthday: { month: "3", day: 1 } }, "生日格式不正確。"],
    [{ birthday: "3/1" }, "生日格式不正確。"],
  ])("拒絕 %j", (over, error) => {
    expect(parseNewCharacter(body(over))).toEqual({ ok: false, error });
  });
});
