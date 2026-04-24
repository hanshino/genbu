import { Suspense } from "react";
import { getSkills, getDistinctClans, getDistinctTargets } from "@/lib/queries/magic";
import { SkillFilters } from "@/components/skills/skill-filters";
import { SkillTable } from "@/components/skills/skill-table";
import { Pagination } from "@/components/common/pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    clan?: string;
    target?: string;
    page?: string;
  }>;
}

export default async function SkillsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const clan = params.clan ?? "";
  const target = params.target ?? "";
  const page = Number(params.page) || 1;

  const result = getSkills({ search, clan, target, page });
  const availableClans = getDistinctClans();
  const availableTargets = getDistinctTargets();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">技能瀏覽</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {result.total.toLocaleString()} 個技能{search || clan || target ? "（符合條件）" : ""}
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={null}>
          <SkillFilters
            initialSearch={search}
            initialClan={clan}
            initialTarget={target}
            availableClans={availableClans}
            availableTargets={availableTargets}
          />
        </Suspense>
      </div>

      <SkillTable skills={result.skills} />

      {result.totalPages > 1 && (
        <div className="mt-6">
          <Suspense fallback={null}>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/skills" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
