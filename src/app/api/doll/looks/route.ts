import { NextResponse } from "next/server";
import { getDollFrames, getDollLooks, getDollRides, getDollSlots } from "@/lib/queries/doll";

export const runtime = "nodejs";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const gender = params.get("g");
  const slot = getDollSlots().find((info) => info.slot === params.get("slot"))?.slot;
  if ((gender !== "m" && gender !== "f") || !slot) {
    return NextResponse.json({ error: "性別或部位無效。" }, { status: 400 });
  }
  const looks = getDollLooks(gender, slot);
  const parts = looks.flatMap((look) => [
    ...look.layers, ...(look.offhandLayers ?? []),
  ]);
  const frames = getDollFrames(gender, parts);
  const rides = slot === "horse"
    ? getDollRides(gender, parts.filter((part) => part.slot === "horse").map((part) => part.sequence))
    : [];
  return NextResponse.json({ looks, frames, rides }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
