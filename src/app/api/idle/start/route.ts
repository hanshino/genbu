import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { IDLE_STAGE_ID, NOVICE_PRESET_IDS } from "@/configs/idle";
import { authedBody, idleJson, startSave, viewOf } from "@/lib/idle-saves";
import { presetProblem } from "@/lib/idle/character";
import { parseNewCharacter } from "@/lib/idle/creation";
import { loadIdleData } from "@/lib/queries/idle";

export const runtime = "nodejs";

/** 建立角色：一律是入門弟子・刀（依性別 102 / 103），玩家只能決定名字、性別、生日與六項屬性的初始加點。 */
export async function POST(request: Request) {
  try {
    const auth = await authedBody(request);
    if (auth instanceof NextResponse) return auth;
    const parsed = parseNewCharacter(auth.body);
    if (!parsed.ok) return idleJson({ error: parsed.error }, 400);
    const { character } = parsed;
    const data = loadIdleData(IDLE_STAGE_ID, NOVICE_PRESET_IDS[character.gender]);
    const problem = data ? presetProblem(data) : "找不到這個角色。";
    if (!data || problem) return idleJson({ error: problem ?? "找不到這個角色。" }, 500);
    const result = startSave(auth.sub, data, randomBytes(4).readUInt32BE(0), Date.now(), character);
    if (!result.ok) return idleJson({ error: result.error }, result.status);
    return idleJson(viewOf(result.state, result.data));
  } catch {
    return idleJson({ error: "無法建立存檔，請稍後再試。" }, 500);
  }
}
