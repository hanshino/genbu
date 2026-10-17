import { NextResponse } from "next/server";
import { JOB_CHANGE_LEVEL, NOVICE_SECT_ID, WEAPON_STYLES } from "@/configs/idle";
import { authedBody, changeSave, idleJson, writeResponse } from "@/lib/idle-saves";
import { canChangeJob, isJobChangeSect } from "@/lib/idle/job";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const { saveCounter, sectId } = auth.body;
    if (typeof saveCounter !== "number" || !Number.isSafeInteger(saveCounter)) {
      return idleJson({ error: "缺少存檔計數。" }, 400);
    }
    if (!isJobChangeSect(sectId)) return idleJson({ error: "請選擇要拜入的門派。" }, 400);
    return writeResponse(
      changeSave(auth.sub, saveCounter, Date.now(), (state) => {
        if (state.sectId !== NOVICE_SECT_ID) return "已經拜入門派，不能再轉職。";
        // 先結算到現在才檢查：離線期間升到 9 級也算。
        if (!canChangeJob(state)) return `需要到 ${JOB_CHANGE_LEVEL} 級才能轉職。`;
        // 轉職只選門派，武器流派先用該門派的第一種（之後可在角色頁切換）。
        const style = WEAPON_STYLES[sectId][0];
        return { presetId: style.presetIds[state.gender], weaponItemId: style.weaponItemId, sectId, skillId: null };
      }),
    );
  } catch {
    return idleJson({ error: "無法轉職，請稍後再試。" }, 500);
  }
}
