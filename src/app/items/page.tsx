import { Suspense } from "react";
import { getItems } from "@/lib/queries/items";
import { ItemFilters } from "@/components/items/item-filters";
import { ItemTable } from "@/components/items/item-table";
import { ItemPagination } from "@/components/items/item-pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function ItemsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const type = params.type ?? "";
  const page = Number(params.page) || 1;

  const result = getItems({ search, type, page });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">道具查詢</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {result.total.toLocaleString()} 筆
          {search || type ? "（符合條件）" : ""}
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={null}>
          <ItemFilters initialSearch={search} initialType={type} />
        </Suspense>
      </div>

      <ItemTable items={result.items} />

      {result.totalPages > 1 && (
        <div className="mt-6">
          <Suspense fallback={null}>
            <ItemPagination page={result.page} totalPages={result.totalPages} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
