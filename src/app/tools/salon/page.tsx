import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { SalonClient, type SalonSelection } from "@/components/doll/salon-client";
import {
  DOLL_EQUIP_SLOTS,
  getDefaultDollOutfit,
  getDollCatalog,
  getDollFrames,
  getDollHeads,
  getDollRules,
  type DollGender,
  type DollPart,
} from "@/lib/queries/doll";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "換裝沙龍 · 玄武",
  description: "挑選各部位的裝備，預覽角色穿上後的樣子。",
  alternates: { canonical: "/tools/salon" },
};

const DIRS = [1, 2, 3, 4, 5, 6, 7, 8];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SalonPage({ searchParams }: Props) {
  const params = await searchParams;
  const gender: DollGender = one(params.g) === "f" ? "f" : "m";
  const heads = getDollHeads(gender);
  const catalog = getDollCatalog(gender);

  // 完全沒帶造型參數 = 第一次進來，給一套預設衣褲；之後網址一定帶 g，空欄位就是真的沒穿
  const fresh = !["g", "head", ...DOLL_EQUIP_SLOTS].some((k) => k in params);
  const outfit = fresh ? getDefaultDollOutfit(gender) : null;

  const headSeq = Number(one(params.head));
  const head = heads.find((h) => h.sequence === headSeq)?.sequence ?? outfit?.head ?? heads[0]?.sequence ?? 0;

  const selection = { gender, head, items: {} } as SalonSelection;
  for (const slot of DOLL_EQUIP_SLOTS) {
    const fallback = slot === "body" || slot === "foot" ? outfit?.[slot] : null;
    const id = outfit ? fallback : Number(one(params[slot]));
    selection.items[slot] = catalog[slot].find((it) => it.itemId === id)?.itemId ?? null;
  }

  const dirParam = Number(one(params.dir));
  const dir = DIRS.includes(dirParam) ? dirParam : 7;

  const parts: DollPart[] = [{ slot: "head", sequence: head }];
  for (const slot of DOLL_EQUIP_SLOTS) {
    const it = catalog[slot].find((c) => c.itemId === selection.items[slot]);
    if (it) parts.push({ slot, sequence: it.sequence });
  }

  // 頭型縮圖只要正面一張
  const headThumbs = getDollFrames(
    gender,
    heads.map((h) => ({ slot: "head", sequence: h.sequence })),
  ).filter((f) => f.dir === 7);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools" />
      </nav>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">換裝沙龍</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          挑選各部位的裝備，預覽角色穿上後的樣子。外觀僅供參考，以遊戲內顯示為準。
        </p>
      </header>
      <SalonClient
        selection={selection}
        initialDir={dir}
        rules={getDollRules()}
        frames={getDollFrames(gender, parts)}
        heads={heads}
        headThumbs={headThumbs}
        catalog={catalog}
      />
    </div>
  );
}
