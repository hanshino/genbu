import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/sort";

export interface SortContext {
  sortBy?: string;
  sortDir?: SortDir;
  searchParamsStr: string;
  basePath: string;
}

interface SortableHeadProps {
  column: string;
  label: React.ReactNode;
  sort: SortContext;
  right?: boolean;
  className?: string;
}

export function nextSortHref(
  searchParamsStr: string,
  basePath: string,
  column: string,
  currentSortBy: string | undefined,
  currentSortDir: SortDir | undefined,
): string {
  const params = new URLSearchParams(searchParamsStr);
  params.delete("page");

  if (currentSortBy === column) {
    if (currentSortDir === "asc") {
      params.set("sortBy", column);
      params.set("sortDir", "desc");
    } else {
      params.delete("sortBy");
      params.delete("sortDir");
    }
  } else {
    params.set("sortBy", column);
    params.set("sortDir", "asc");
  }

  return `${basePath}${params.size > 0 ? `?${params}` : ""}`;
}

export function SortableHead({ column, label, sort, right = false, className }: SortableHeadProps) {
  const isActive = sort.sortBy === column;
  const href = nextSortHref(sort.searchParamsStr, sort.basePath, column, sort.sortBy, sort.sortDir);

  // Treat unset sortDir on an active column as asc (matches query default).
  const Icon = !isActive
    ? ChevronsUpDownIcon
    : sort.sortDir === "desc"
      ? ChevronDownIcon
      : ChevronUpIcon;
  const ariaSort = !isActive ? "none" : sort.sortDir === "desc" ? "descending" : "ascending";

  return (
    <TableHead aria-sort={ariaSort} className={cn(className, right && "text-right")}>
      <Link
        href={href}
        className={cn(
          "flex h-full w-full items-center gap-1 transition-colors duration-150 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          right && "justify-end",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
    </TableHead>
  );
}
