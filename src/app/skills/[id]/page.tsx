import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { getSkillById, getSkillsByClan } from "@/lib/queries/magic";
import { SkillDetail } from "@/components/skills/skill-detail";
import { SkillLevelTable } from "@/components/skills/skill-level-table";
import { RelatedSkills } from "@/components/skills/related-skills";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const rows = getSkillById(Number(id));
  if (rows.length === 0) return { title: "技能不存在 · 玄武" };
  const first = rows[0];
  return {
    title: `${first.name} · 技能 · 玄武`,
    description: `${first.name} 的全等級數值與同門派技能`,
  };
}

export default async function SkillDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { level } = await searchParams;
  const skillId = Number(id);
  if (!Number.isInteger(skillId) || skillId <= 0) notFound();

  const rows = getSkillById(skillId);
  if (rows.length === 0) notFound();

  const levels = rows.map((r) => r.level);
  const maxLevel = Math.max(...levels);
  const requestedLevel = Number(level);
  const currentLevel =
    Number.isInteger(requestedLevel) && levels.includes(requestedLevel) ? requestedLevel : maxLevel;
  const current = rows.find((r) => r.level === currentLevel) ?? rows[rows.length - 1];
  const base = rows[0];

  const related = base.clan ? getSkillsByClan(base.clan, skillId, 10) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/skills" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeftIcon className="size-3.5" aria-hidden />
          返回技能列表
        </Link>
      </nav>

      <SkillDetail skill={base} current={current} allLevels={levels} />

      <SkillLevelTable rows={rows} />

      {base.clan && <RelatedSkills clan={base.clan} skills={related} />}
    </div>
  );
}
