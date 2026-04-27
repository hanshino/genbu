import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMonsterById, getDropsForMonster } from "@/lib/queries/monsters";
import { getStagesForMonster } from "@/lib/queries/monster-spawns";
import { MonsterDetailView } from "@/components/monsters/monster-detail";
import { MonsterDropTable } from "@/components/monsters/monster-drop-table";
import { MonsterStageSpawns } from "@/components/monsters/monster-stage-spawns";
import { HitRequirementPanel } from "@/components/monsters/hit-requirement-panel";
import { BackLink } from "@/components/common/back-link";
import { SKILL_PICKS, type SkillSchool } from "@/lib/constants/skill-picks";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ school?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const monster = getMonsterById(Number(id));
  if (!monster) return { title: "怪物不存在 · 玄武" };
  return {
    title: `${monster.name} · 怪物 · 玄武`,
    description: `${monster.name} 的屬性、掉落與出現資訊`,
  };
}

const DEFAULT_SCHOOL: SkillSchool = "刀法";

function resolveSchool(raw: string | undefined): SkillSchool {
  if (raw && raw in SKILL_PICKS) return raw as SkillSchool;
  return DEFAULT_SCHOOL;
}

export default async function MonsterDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { school: rawSchool } = await searchParams;
  const monsterId = Number(id);
  if (!Number.isInteger(monsterId) || monsterId <= 0) notFound();

  const monster = getMonsterById(monsterId);
  if (!monster) notFound();

  const { drops, totalWeight } = getDropsForMonster(monsterId);
  const stageSpawns = getStagesForMonster(monsterId);
  const school = resolveSchool(rawSchool);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/monsters">返回怪物列表</BackLink>
      </nav>

      <MonsterDetailView monster={monster} />

      <HitRequirementPanel dodge={monster.base_dodge} school={school} />

      <MonsterDropTable drops={drops} totalWeight={totalWeight} />

      <MonsterStageSpawns spawns={stageSpawns} />
    </div>
  );
}
