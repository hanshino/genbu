import { NextResponse } from "next/server";
import { authedBody, changeSave, idleJson, writeResponse } from "@/lib/idle-saves";
import { stylesFor } from "@/lib/idle/job";

export const runtime = "nodejs";

/** 換武器流派（刀法 ⇄ 詐招…）：換成該流派的預設角色外觀與武器，技能改回自動。 */
export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const { saveCounter, style: key } = auth.body;
    if (typeof saveCounter !== "number" || !Number.isSafeInteger(saveCounter)) {
      return idleJson({ error: "缺少存檔計數。" }, 400);
    }
    if (typeof key !== "string") return idleJson({ error: "請選擇武器。" }, 400);
    return writeResponse(
      changeSave(auth.sub, saveCounter, Date.now(), (state) => {
        const styles = stylesFor(state.sectId);
        if (styles.length === 0) return "入門弟子還不能換武器，先轉職拜入門派吧。";
        const style = styles.find((s) => s.key === key);
        if (!style) return "不認得這種武器。";
        if (!style.enabled) return `${style.label}${style.note ? `：${style.note}` : "尚未開放"}。`;
        return { presetId: style.presetIds[state.gender], weaponItemId: style.weaponItemId, skillId: null };
      }),
    );
  } catch {
    return idleJson({ error: "無法換武器，請稍後再試。" }, 500);
  }
}
