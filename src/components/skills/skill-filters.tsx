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
import { magicSkillTypeLabel } from "@/lib/constants/magic-skill-type";
import { FILTER_ALL } from "@/lib/constants/filters";
import { track } from "@/lib/analytics/track";

interface FilterState {
  search: string;
  clan: string;
  target: string;
  skillType: string;
}

export function SkillFilters({
  initialSearch,
  initialClan,
  initialTarget,
  initialSkillType,
  availableClans,
  availableTargets,
  availableSkillTypes,
}: {
  initialSearch: string;
  initialClan: string;
  initialTarget: string;
  initialSkillType: string;
  availableClans: string[];
  availableTargets: string[];
  availableSkillTypes: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [clan, setClan] = useState(initialClan || FILTER_ALL);
  const [target, setTarget] = useState(initialTarget || FILTER_ALL);
  const [skillType, setSkillType] = useState(initialSkillType || FILTER_ALL);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      pushState({ search, clan, target, skillType });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function pushState(next: FilterState) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search.trim()) params.set("search", next.search.trim());
    else params.delete("search");
    if (next.clan && next.clan !== FILTER_ALL) params.set("clan", next.clan);
    else params.delete("clan");
    if (next.target && next.target !== FILTER_ALL) params.set("target", next.target);
    else params.delete("target");
    if (next.skillType && next.skillType !== FILTER_ALL) params.set("skillType", next.skillType);
    else params.delete("skillType");
    params.delete("page");
    const nextQs = params.toString();
    const currentQs = new URLSearchParams(searchParams.toString());
    currentQs.delete("page");
    if (currentQs.toString() === nextQs) return;
    startTransition(() => {
      router.push(`/skills${nextQs ? `?${nextQs}` : ""}`);
    });
    const query = next.search.trim();
    const hasFilter =
      (!!next.clan && next.clan !== FILTER_ALL) ||
      (!!next.target && next.target !== FILTER_ALL) ||
      (!!next.skillType && next.skillType !== FILTER_ALL);
    if (query.length > 0 || hasFilter) {
      track("search_submit", {
        scope: "skills",
        query_len: query.length,
        has_filter: hasFilter,
      });
    }
  }

  // Preserve canonical ordering, but only show clans/targets that exist in DB.
  const clanOptions = MAGIC_CLAN_ORDER.filter((c) => availableClans.includes(c));
  const targetOptions = MAGIC_TARGET_ORDER.filter((t) => availableTargets.includes(t));
  const skillTypeOptions = [...availableSkillTypes].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Input
        placeholder="搜尋技能名稱或編號..."
        aria-label="搜尋技能名稱或編號"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        inputMode="search"
        className="sm:max-w-xs"
      />
      <Select
        value={clan}
        onValueChange={(v) => {
          const nextClan = v ?? FILTER_ALL;
          setClan(nextClan);
          pushState({ search, clan: nextClan, target, skillType });
        }}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue>
            {(v: unknown) =>
              v == null || v === FILTER_ALL ? "全部門派" : magicClanLabel(String(v))
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>全部門派</SelectItem>
          {clanOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {magicClanLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={skillType}
        onValueChange={(v) => {
          const next = v ?? FILTER_ALL;
          setSkillType(next);
          pushState({ search, clan, target, skillType: next });
        }}
      >
        <SelectTrigger className="sm:w-[160px]">
          <SelectValue>
            {(v: unknown) =>
              v == null || v === FILTER_ALL ? "全部分類" : magicSkillTypeLabel(Number(v))
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>全部分類</SelectItem>
          {skillTypeOptions.map((st) => (
            <SelectItem key={st} value={String(st)}>
              {magicSkillTypeLabel(st)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={target}
        onValueChange={(v) => {
          const nextTarget = v ?? FILTER_ALL;
          setTarget(nextTarget);
          pushState({ search, clan, target: nextTarget, skillType });
        }}
      >
        <SelectTrigger className="sm:w-[180px]">
          <SelectValue>
            {(v: unknown) =>
              v == null || v === FILTER_ALL ? "全部作用目標" : magicTargetLabel(String(v))
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>全部作用目標</SelectItem>
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
