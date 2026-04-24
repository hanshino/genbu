import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getSkillById,
  getSkillGroup,
  getSkillRow,
  getSkillsByClan,
} from "@/lib/queries/magic";
import { getStatusById } from "@/lib/queries/status";
import { SkillDetail } from "@/components/skills/skill-detail";
import { SkillLevelTable } from "@/components/skills/skill-level-table";
import { RelatedSkills } from "@/components/skills/related-skills";
import { BackLink } from "@/components/common/back-link";
import type { Magic } from "@/lib/types/magic";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ level?: string }>;
}

// 透過 URL 的 ?level= 把 (id, level) 鎖成單一技能。若沒帶 level，fallback 成這個 id 底下最低 level 那筆技能。
function resolveAnchor(skillId: number, rawLevel: string | undefined): Magic | null {
  const parsed = Number(rawLevel);
  if (Number.isInteger(parsed) && parsed > 0) {
    const row = getSkillRow(skillId, parsed);
    if (row) return row;
  }
  const all = getSkillById(skillId);
  return all[0] ?? null;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { level } = await searchParams;
  const skillId = Number(id);
  if (!Number.isInteger(skillId) || skillId <= 0) return { title: "技能不存在 · 玄武" };
  const anchor = resolveAnchor(skillId, level);
  if (!anchor) return { title: "技能不存在 · 玄武" };
  return {
    title: `${anchor.name} · 技能 · 玄武`,
    description: `${anchor.name} 的全等級數值與同門派技能`,
  };
}

export default async function SkillDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { level } = await searchParams;
  const skillId = Number(id);
  if (!Number.isInteger(skillId) || skillId <= 0) notFound();

  const anchor = resolveAnchor(skillId, level);
  if (!anchor) notFound();

  const rows = getSkillGroup(anchor.id, anchor.name);
  if (rows.length === 0) notFound();

  const levels = rows.map((r) => r.level);
  const maxLevel = Math.max(...levels);
  const currentLevel = levels.includes(anchor.level) ? anchor.level : maxLevel;
  const current = rows.find((r) => r.level === currentLevel) ?? rows[rows.length - 1];
  const base = rows[0];

  const related = base.clan
    ? getSkillsByClan(base.clan, { id: base.id, name: base.name }, 10)
    : [];
  const status = current.extra_status != null ? getStatusById(current.extra_status) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <BackLink href="/skills">返回技能列表</BackLink>
      </nav>

      <SkillDetail skill={base} current={current} allLevels={levels} status={status} />

      <SkillLevelTable rows={rows} />

      {base.clan && <RelatedSkills clan={base.clan} skills={related} />}
    </div>
  );
}
