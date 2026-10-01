import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { MapPinOffIcon } from "lucide-react";
import { getNpcDetail } from "@/lib/queries/npcs";
import { BackLink } from "@/components/common/back-link";
import { NpcPortrait } from "@/components/missions/npc-portrait";
import { NpcMapsSection, NpcMissionsSection } from "@/components/npcs/npc-sections";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = parseId((await params).id);
  const npc = id ? getNpcDetail(id) : null;
  if (!npc) return { title: "NPC 不存在 · 玄武" };
  return {
    title: `${npc.name} 在哪 · NPC 位置查詢 · 玄武`,
    description: `武林同萌傳 NPC「${npc.name}」出現的地圖`,
    alternates: { canonical: `/npcs/${npc.id}` },
  };
}

export default async function NpcDetailPage({ params }: PageProps) {
  const id = parseId((await params).id);
  if (!id) notFound();

  const npc = getNpcDetail(id);
  if (!npc) notFound();
  // 同名 NPC 合成一組，只留代表 id 一個網址
  if (npc.id !== id) permanentRedirect(`/npcs/${npc.id}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/npcs" />
      </nav>

      <header className="flex items-center gap-4 sm:gap-6">
        <NpcPortrait image={npc.image} name={npc.name} className="size-24 sm:size-32" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">NPC</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{npc.name}</h1>
          {npc.maps.length > 0 && (
            <p className="text-sm text-muted-foreground">出現在 {npc.maps.length} 張地圖</p>
          )}
        </div>
      </header>

      {npc.maps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapPinOffIcon className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            資料裡沒有這位 NPC 出現的地圖，可能是活動、任務專用或已停用的 NPC。
          </p>
        </div>
      ) : (
        <NpcMapsSection maps={npc.maps} />
      )}

      <NpcMissionsSection missions={npc.missions} />
    </div>
  );
}
