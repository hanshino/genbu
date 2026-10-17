import { NextResponse } from "next/server";
import { applyAllocation } from "@/lib/idle/allocation";
import { authedBody, changeSave, idleJson, writeResponse } from "@/lib/idle-saves";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const { saveCounter, attributes } = auth.body;
    if (typeof saveCounter !== "number" || !Number.isSafeInteger(saveCounter)) {
      return idleJson({ error: "缺少存檔計數。" }, 400);
    }
    return writeResponse(
      changeSave(auth.sub, saveCounter, Date.now(), (state) => {
        const applied = applyAllocation(state, attributes);
        if ("error" in applied) return applied.error;
        return {
          attributes: applied.attributes,
          unspentPoints: state.unspentPoints - applied.cost,
        };
      }),
    );
  } catch {
    return idleJson({ error: "無法配點，請稍後再試。" }, 500);
  }
}
