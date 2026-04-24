"use client";

import { Pagination } from "@/components/common/pagination";

export function ItemPagination({ page, totalPages }: { page: number; totalPages: number }) {
  return <Pagination page={page} totalPages={totalPages} basePath="/items" />;
}
