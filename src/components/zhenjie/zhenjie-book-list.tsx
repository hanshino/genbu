"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ItemIcon } from "@/components/common/item-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StarRating } from "@/components/zhenjie/star-rating";
import { MAGIC_CLAN_LABELS, MAGIC_CLAN_ORDER } from "@/lib/constants/magic-clan";
import type { EntityImage } from "@/lib/queries/images";
import type { ZhenjieBook } from "@/lib/queries/zhenjie";

/** magic.clan 為 null 的真解：翔龍、疾殺這類各門派都能學的武學。 */
const NO_CLAN = "none";
const NO_CLAN_LABEL = "不限門派";

function clanLabel(clan: string | null): string {
  return clan ? (MAGIC_CLAN_LABELS[clan] ?? clan) : NO_CLAN_LABEL;
}

export function ZhenjieBookList({
  books,
  icons,
}: {
  books: ZhenjieBook[];
  icons: Record<number, EntityImage>;
}) {
  const [star, setStar] = useState("all");
  const [clan, setClan] = useState("all");

  const starOptions = useMemo(
    () => [...new Set(books.map((b) => b.stars))].sort((a, b) => b - a),
    [books],
  );
  const clanOptions = useMemo(() => {
    const present = new Set(books.map((b) => b.clan ?? NO_CLAN));
    const ordered = MAGIC_CLAN_ORDER.filter((c) => present.has(c));
    return present.has(NO_CLAN) ? [...ordered, NO_CLAN] : ordered;
  }, [books]);

  const filtered = books.filter(
    (b) =>
      (star === "all" || b.stars === Number(star)) &&
      (clan === "all" || (b.clan ?? NO_CLAN) === clan),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          aria-label="星數"
          value={[star]}
          onValueChange={(value) => {
            if (value[0]) setStar(value[0]);
          }}
        >
          <ToggleGroupItem value="all" size="sm">
            全部
          </ToggleGroupItem>
          {starOptions.map((s) => (
            <ToggleGroupItem key={s} value={String(s)} size="sm" aria-label={`${s} 星`}>
              {s}星
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={clan} onValueChange={(v) => v && setClan(v)}>
          <SelectTrigger className="h-8 w-[140px]" aria-label="門派">
            <SelectValue>
              {(v: unknown) => (v === "all" ? "全部門派" : clanLabel(v === NO_CLAN ? null : String(v)))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部門派</SelectItem>
            {clanOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {clanLabel(c === NO_CLAN ? null : c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} 本</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center text-muted-foreground">
          找不到符合條件的真解
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>真解</TableHead>
                <TableHead>星數</TableHead>
                <TableHead>對應技能</TableHead>
                <TableHead>門派</TableHead>
                <TableHead className="text-right">強度範圍</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link
                      href={`/items/${b.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <ItemIcon image={icons[b.id]} alt={b.name} className="size-6" />
                      {b.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StarRating stars={b.stars} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/skills/${b.skillId}`} className="hover:underline">
                      {b.skillName ?? `#${b.skillId}`}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{clanLabel(b.clan)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {b.strengthMin}~{b.strengthMax}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
