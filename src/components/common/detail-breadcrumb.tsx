"use client";

import { useRouter } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cameFrom } from "@/lib/nav-history";

// 詳情頁頂端的「列表 › 本頁」。直接從外部連進來的人也看得出自己在哪一類資料裡。
// 上一頁就是那個列表時走 history.back()，保留列表的篩選、分頁與捲動位置。
export function DetailBreadcrumb({
  parent,
  current,
}: {
  parent: { href: string; label: string };
  current: string;
}) {
  const router = useRouter();

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            href={parent.href}
            onClick={(e) => {
              if (cameFrom(parent.href)) {
                e.preventDefault();
                router.back();
              }
            }}
          >
            {parent.label}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
