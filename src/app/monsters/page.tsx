import { Suspense } from "react";
import {
  getMonsters,
  getDistinctMonsterTypes,
  getDistinctElementals,
} from "@/lib/queries/monsters";
import { MonsterFilters } from "@/components/monsters/monster-filters";
import { MonsterTable } from "@/components/monsters/monster-table";
import { Pagination } from "@/components/common/pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
    elemental?: string;
    hasDrop?: string;
    isNormal?: string;
    page?: string;
    sortBy?: string;
    sortDir?: string;
  }>;
}

export default async function MonstersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const typeRaw = params.type ?? "";
  const elemental = params.elemental ?? "";
  const hasDrop = params.hasDrop === "1";
  const isNormal = params.isNormal === "1";
  const page = Number(params.page) || 1;
  const sortBy = params.sortBy;
  const sortDir = params.sortDir;

  const typeNum = typeRaw ? Number(typeRaw) : undefined;
  const result = getMonsters({
    search,
    type: Number.isInteger(typeNum) ? typeNum : undefined,
    elemental: elemental || undefined,
    hasDrop,
    isNormal,
    page,
    sortBy,
    sortDir,
  });
  const availableTypes = getDistinctMonsterTypes();
  const availableElementals = getDistinctElementals();

  const hasFilter = !!(search || typeRaw || elemental || hasDrop || isNormal);

  // params is Record<string, string | undefined> at runtime; drop null/empty.
  const searchParamsStr = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => {
      const v = entry[1];
      return v != null && v !== "";
    }),
  ).toString();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">怪物查詢</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {result.total.toLocaleString()} 隻{hasFilter ? "（符合條件）" : ""}
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={null}>
          <MonsterFilters
            initialSearch={search}
            initialType={typeRaw}
            initialElemental={elemental}
            initialHasDrop={hasDrop}
            initialIsNormal={isNormal}
            availableTypes={availableTypes}
            availableElementals={availableElementals}
          />
        </Suspense>
      </div>

      <MonsterTable
        monsters={result.monsters}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParamsStr={searchParamsStr}
      />

      {result.totalPages > 1 && (
        <div className="mt-6">
          <Suspense fallback={null}>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/monsters" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
