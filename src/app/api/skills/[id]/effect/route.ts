import { NextResponse } from "next/server";
import { getSkillEffectBundle } from "@/lib/queries/skill-effect";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const magicId = Number(id);
  const bundle = Number.isSafeInteger(magicId) && magicId > 0 ? getSkillEffectBundle(magicId) : null;
  if (!bundle) {
    return NextResponse.json({ error: "此技能沒有演出資料。" }, { status: 404 });
  }
  // 資料只隨資料庫版本更新。
  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
