import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { SalonClient, type SalonWorn } from "@/components/doll/salon-client";
import {
  getDollBase,
  getDollDefaults,
  getDollFrames,
  getDollHeads,
  getDollHairColors,
  getDollLookByItem,
  getDollLooks,
  getDollRules,
  getDollSlots,
  type DollGender,
  type DollLook,
  type DollPart,
} from "@/lib/queries/doll";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "換裝沙龍 · 玄武",
  description: "挑選各部位的外觀，預覽角色穿上後的樣子。",
  alternates: { canonical: "/tools/salon" },
};

const DIRS = [1, 2, 3, 4, 5, 6, 7, 8];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function resolveWorn(
  gender: DollGender,
  slots: { slot: string }[],
  idOf: (slot: string) => number | undefined,
): SalonWorn {
  const worn: SalonWorn = {};
  for (const { slot } of slots) {
    const itemId = idOf(slot);
    if (!itemId) continue;
    const look = getDollLookByItem(gender, itemId);
    if (look && look.slot === slot) worn[look.slot] = { itemId, look };
  }
  return worn;
}

const lookParts = (look: DollLook): DollPart[] => [...look.layers, ...(look.offhandLayers ?? [])];

export default async function SalonPage({ searchParams }: Props) {
  const params = await searchParams;
  const gender: DollGender = one(params.g) === "f" ? "f" : "m";
  const slots = getDollSlots();
  const heads = getDollHeads(gender);
  const hairColors = getDollHairColors(gender);
  const base = getDollBase(gender);

  // 預設造型一律帶給 client，「重設」就不用再跑一趟伺服器
  const defaults = getDollDefaults(gender);
  const defaultWorn = resolveWorn(
    gender,
    slots,
    (s) => defaults.items[s as keyof typeof defaults.items],
  );

  // 完全沒帶頭型／部位參數 = 第一次進來，套預設造型；之後網址一定帶 head，空欄位就是真的沒穿
  const fresh = !["head", ...slots.map((s) => s.slot)].some((k) => k in params);
  const worn = fresh
    ? defaultWorn
    : resolveWorn(gender, slots, (s) => Number(one(params[s])) || undefined);

  const headParam = Number(one(params.head));
  const head = heads.some((h) => h.sequence === headParam) ? headParam : defaults.head;
  const dirParam = Number(one(params.dir));
  const dir = DIRS.includes(dirParam) ? dirParam : 7;
  const hand = one(params.hand) === "l" ? "l" : "r";
  const hairParam = Number(one(params.hair));
  const hair = Number.isInteger(hairParam) && hairParam >= 1 && hairParam <= 10 ? hairParam : 0;

  // ponytail: 分頁數字要每個部位各查一次；DB 查詢在毫秒級，慢了再改成只算數量的 SQL
  const looksBySlot = Object.fromEntries(slots.map((s) => [s.slot, getDollLooks(gender, s.slot)]));
  const counts = Object.fromEntries(slots.map((s) => [s.slot, looksBySlot[s.slot].length]));
  const initialTab = slots.find((s) => s.slot === "body")?.slot ?? slots[0]?.slot ?? "body";
  const initialLooks = looksBySlot[initialTab] ?? [];

  const parts: DollPart[] = [
    ...heads.map((h) => ({ slot: "head" as const, sequence: h.sequence })),
    ...Object.values(base),
    ...initialLooks.flatMap(lookParts),
    ...Object.values(worn).flatMap((w) => lookParts(w!.look)),
    ...Object.values(defaultWorn).flatMap((w) => lookParts(w!.look)),
  ];
  const frames = getDollFrames(gender, parts);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools" />
      </nav>
      <header className="mb-5">
        <h1 className="font-heading text-3xl font-bold">換裝沙龍</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          挑選各部位的外觀，預覽角色穿上後的樣子。相同外觀的道具合併成一格，點格子就能換裝。
        </p>
      </header>
      <SalonClient
        key={gender}
        gender={gender}
        slots={slots}
        counts={counts}
        heads={heads}
        hairColors={hairColors}
        initialHair={hair}
        rules={getDollRules()}
        initialFrames={frames}
        initialTab={initialTab}
        initialLooks={initialLooks}
        initialWorn={worn}
        defaultWorn={defaultWorn}
        initialHead={head}
        defaultHead={defaults.head}
        initialDir={dir}
        initialHand={hand}
        base={base}
      />
    </div>
  );
}
