import { describe, it, expect } from "vitest";
import { getStatusById } from "../status";

describe("getStatusById", () => {
  it("returns 照明 / group 29 for known id 2061", () => {
    const s = getStatusById(2061);
    expect(s).not.toBeNull();
    expect(s?.name).toBe("照明");
    expect(s?.group).toBe(29);
    expect(s?.order).toBe(1);
  });

  it("returns null for non-existent id (orphan extra_status case)", () => {
    // 資料裡有 ~122 筆 magic.extra_status 指向不存在的 status id；
    // 挑一個確定不在 STATUS.INI 的大 id 驗證 null fallback。
    const s = getStatusById(999999);
    expect(s).toBeNull();
  });
});
