"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { magicClanLabel, MAGIC_CLAN_ORDER } from "@/lib/constants/magic-clan";
import { magicTargetLabel, MAGIC_TARGET_ORDER } from "@/lib/constants/magic-target";

const ALL = "__all__";

export function SkillFilters({
  initialSearch,
  initialClan,
  initialTarget,
  availableClans,
  availableTargets,
}: {
  initialSearch: string;
  initialClan: string;
  initialTarget: string;
  availableClans: string[];
  availableTargets: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [clan, setClan] = useState(initialClan || ALL);
  const [target, setTarget] = useState(initialTarget || ALL);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      pushState({ search, clan, target });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function pushState(next: { search: string; clan: string; target: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search.trim()) params.set("search", next.search.trim());
    else params.delete("search");
    if (next.clan && next.clan !== ALL) params.set("clan", next.clan);
    else params.delete("clan");
    if (next.target && next.target !== ALL) params.set("target", next.target);
    else params.delete("target");
    params.delete("page");
    startTransition(() => {
      router.push(`/skills${params.size > 0 ? `?${params.toString()}` : ""}`);
    });
  }

  // Preserve canonical ordering, but only show clans/targets that exist in DB.
  const clanOptions = MAGIC_CLAN_ORDER.filter((c) => availableClans.includes(c));
  const targetOptions = MAGIC_TARGET_ORDER.filter((t) => availableTargets.includes(t));

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input
        placeholder="搜尋技能名稱或編號..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        inputMode="search"
        className="sm:max-w-xs"
      />
      <Select
        value={clan}
        onValueChange={(v) => {
          const nextClan = v ?? ALL;
          setClan(nextClan);
          pushState({ search, clan: nextClan, target });
        }}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="全部門派" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部門派</SelectItem>
          {clanOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {magicClanLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={target}
        onValueChange={(v) => {
          const nextTarget = v ?? ALL;
          setTarget(nextTarget);
          pushState({ search, clan, target: nextTarget });
        }}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue placeholder="全部作用目標" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部作用目標</SelectItem>
          {targetOptions.map((t) => (
            <SelectItem key={t} value={t}>
              {magicTargetLabel(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
