"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, ListIcon } from "lucide-react";
import type { GuideHeading } from "@/lib/guides";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

function useActiveHeading(headings: GuideHeading[]) {
  const [active, setActive] = useState(headings[0]?.id ?? null);
  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [headings]);
  return active;
}

function TocLinks({
  headings,
  active,
  onNavigate,
}: {
  headings: GuideHeading[];
  active: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {headings.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            onClick={onNavigate}
            aria-current={active === h.id ? "location" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring -ml-2.5 block rounded-md px-2.5 py-1.5 text-[13px] leading-normal outline-none focus-visible:ring-2 motion-safe:transition-colors",
              "aria-[current=location]:bg-primary/10 aria-[current=location]:text-foreground aria-[current=location]:font-medium",
            )}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function GuideTocDesktop({ headings }: { headings: GuideHeading[] }) {
  const active = useActiveHeading(headings);
  if (headings.length === 0) return null;
  return (
    <nav aria-label="本篇目錄" className="sticky top-20 hidden border-l pl-[18px] lg:block">
      <p className="text-muted-foreground mb-3 text-[11.5px] tracking-[0.16em]">本篇段落</p>
      <TocLinks headings={headings} active={active} />
    </nav>
  );
}

export function GuideTocMobile({ headings }: { headings: GuideHeading[] }) {
  const [open, setOpen] = useState(false);
  const active = useActiveHeading(headings);
  if (headings.length === 0) return null;
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-card mb-2 overflow-hidden rounded-xl border lg:hidden"
    >
      <CollapsibleTrigger className="group text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center gap-2.5 px-4 py-3 text-[13.5px]">
        <ListIcon className="size-4" aria-hidden />
        這篇有 {headings.length} 段
        <ChevronDownIcon
          className="ml-auto size-4 group-data-panel-open:rotate-180 motion-safe:transition-transform"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsiblePanel className="motion-reduce:transition-none">
        <nav aria-label="本篇目錄" className="border-t px-3 pt-1.5 pb-2.5 pl-5.5">
          <TocLinks headings={headings} active={active} onNavigate={() => setOpen(false)} />
        </nav>
      </CollapsiblePanel>
    </Collapsible>
  );
}
