import { NextResponse } from "next/server";
import { getDollFrames, getDollLooks, getDollSlots } from "@/lib/queries/doll";

export const runtime = "nodejs";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const gender = params.get("g");
  const slot = getDollSlots().find((info) => info.slot === params.get("slot"))?.slot;
  if ((gender !== "m" && gender !== "f") || !slot) {
    return NextResponse.json({ error: "性別或部位無效。" }, { status: 400 });
  }
  const looks = getDollLooks(gender, slot);
  const frames = getDollFrames(gender, looks.flatMap((look) => [
    ...look.layers, ...(look.offhandLayers ?? []),
  ]));
  return NextResponse.json({ looks, frames }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
