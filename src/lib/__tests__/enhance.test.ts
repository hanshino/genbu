import { describe, it, expect } from "vitest";
import {
  ENHANCE_ATTR_KEYS,
  decodeEnhance,
  encodeEnhance,
  formatEnhance,
  parseEnhance,
  suggestEnhance,
} from "@/lib/enhance";
import { ENHANCEMENT_ATTR_KEYS } from "@/lib/queries/compound";

describe("ENHANCE_ATTR_KEYS", () => {
  it("跟 compounds 那份強化屬性清單同一組", () => {
    expect([...ENHANCE_ATTR_KEYS].sort()).toEqual([...ENHANCEMENT_ATTR_KEYS].sort());
  });
});

describe("parseEnhance", () => {
  it("認得的屬性 key 給中文與數值", () => {
    expect(parseEnhance("matk:8")).toEqual({ key: "matk", label: "內勁", value: 8 });
  });

  it.each(["nope:8", "matk:0", "matk:-3", "matk:1.5", "matk", "matk:abc", ""])(
    "認不得的 %s 回 null",
    (code) => {
      expect(parseEnhance(code)).toBeNull();
    },
  );
});

describe("formatEnhance", () => {
  it("顯示成中文加值", () => {
    expect(formatEnhance("hit:7")).toBe("命中 +7");
  });

  it("壞掉的編碼原樣吐回去，不要整列空白", () => {
    expect(formatEnhance("???")).toBe("???");
  });
});

describe("decodeEnhance / encodeEnhance", () => {
  it("逗號串接來回一致", () => {
    expect(decodeEnhance("matk:8,hit:7")).toEqual(["matk:8", "hit:7"]);
    expect(encodeEnhance(["matk:8", "hit:7"])).toBe("matk:8,hit:7");
  });

  it("空值兩邊都當成沒強化", () => {
    expect(decodeEnhance(null)).toEqual([]);
    expect(decodeEnhance("")).toEqual([]);
    expect(encodeEnhance([])).toBeNull();
  });

  it("壞掉的段落丟掉，不讓一筆爛資料弄掛整頁", () => {
    expect(decodeEnhance("matk:8,爛資料,hit:7")).toEqual(["matk:8", "hit:7"]);
    expect(encodeEnhance(["matk:8", "nope:1"])).toBe("matk:8");
  });
});

describe("suggestEnhance", () => {
  it("屬性名加數值就給可直接成標籤的編碼", () => {
    expect(suggestEnhance("內勁8").codes).toEqual(["matk:8"]);
  });

  it("中間的空白與加號不影響辨識", () => {
    expect(suggestEnhance("內勁 +8").codes).toEqual(["matk:8"]);
  });

  it("只打屬性名時沒有編碼，只回比對到的名字當提示", () => {
    const { codes, labels } = suggestEnhance("內");
    expect(codes).toEqual([]);
    expect(labels).toEqual(["內勁", "內力"]);
  });

  it("已經選過的屬性不再出現在建議裡", () => {
    expect(suggestEnhance("內", ["matk:8"]).labels).toEqual(["內力"]);
  });

  it("空字串不把 20 種屬性全倒出來", () => {
    expect(suggestEnhance("")).toEqual({ codes: [], labels: [] });
  });

  it("認不得的字沒有任何建議", () => {
    expect(suggestEnhance("香蕉9")).toEqual({ codes: [], labels: [] });
  });
});
