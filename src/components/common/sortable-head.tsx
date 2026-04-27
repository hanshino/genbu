import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableHeadProps {
  column: string;
  label: React.ReactNode;
  currentSortBy?: string;
  currentSortDir?: string;
  searchParamsStr: string;
  basePath: string;
  right?: boolean;
  className?: string;
}

export function nextSortHref(
  searchParamsStr: string,
  basePath: string,
  column: string,
  currentSortBy: string | undefined,
  currentSortDir: string | undefined,
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

export function SortableHead({
  column,
  label,
  currentSortBy,
  currentSortDir,
  searchParamsStr,
  basePath,
  right = false,
  className,
}: SortableHeadProps) {
  const isActive = currentSortBy === column;
  const href = nextSortHref(searchParamsStr, basePath, column, currentSortBy, currentSortDir);

  const Icon =
    isActive && currentSortDir === "asc"
      ? ChevronUpIcon
      : isActive && currentSortDir === "desc"
        ? ChevronDownIcon
        : ChevronsUpDownIcon;

  return (
    <TableHead
      aria-sort={isActive ? (currentSortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(className, right && "text-right")}
    >
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
