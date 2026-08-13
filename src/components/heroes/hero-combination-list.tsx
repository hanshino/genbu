import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { HeroCombination, HeroCombinationBonus } from "@/lib/types/hero";

/** 加成欄位顯示順序與中文名。 */
const BONUS_ROWS: { key: keyof HeroCombinationBonus; label: string }[] = [
  { key: "hp", label: "體力" },
  { key: "mp", label: "真氣" },
  { key: "atk", label: "物攻" },
  { key: "matk", label: "內勁" },
  { key: "def", label: "防禦" },
  { key: "mdef", label: "護勁" },
  { key: "dodge", label: "閃躲" },
  { key: "hit", label: "命中" },
];

interface Props {
  combinations: HeroCombination[];
  /** 目前所在的英雄，用來在成員清單中標出自己。 */
  currentHeroId: number;
}

export function HeroCombinationList({ combinations, currentHeroId }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">參與的組合</h2>
        {combinations.length > 0 && (
          <span className="text-xs text-muted-foreground">{combinations.length} 組</span>
        )}
      </div>

      {combinations.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card px-4 py-6 text-sm text-muted-foreground">
          這位英雄沒有出現在任何 hero_connect 組合中。
        </p>
      ) : (
        <ul className="space-y-3">
          {combinations.map((combo) => (
            <li key={combo.id} className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="font-medium">{combo.name}</h3>
                <span className="font-mono text-xs text-muted-foreground">#{combo.id}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  需要 {combo.heroCount} 位
                </span>
              </div>

              {combo.help && <p className="text-sm leading-relaxed">{combo.help}</p>}

              <MemberList combo={combo} currentHeroId={currentHeroId} />

              <BonusList bonus={combo.bonus} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        組合資料只記錄成員與加成欄位。啟用條件、加成套用到哪個對象、多組組合能否疊加，
        以及成員是否需要同時出戰，資料中都沒有記錄，目前未知。
      </p>
    </section>
  );
}

function MemberList({ combo, currentHeroId }: { combo: HeroCombination; currentHeroId: number }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">成員</p>
      <ul className="flex flex-wrap gap-2">
        {combo.members.map((member) => {
          const isCurrent = member.heroId === currentHeroId;
          return (
            <li key={member.slot}>
              {isCurrent ? (
                <Badge variant="secondary" className="font-normal" aria-current="page">
                  {member.name}
                  <span className="text-muted-foreground">（本頁）</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="font-normal"
                  render={<Link href={`/heroes/${member.heroId}`} />}
                >
                  {member.name}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BonusList({ bonus }: { bonus: HeroCombinationBonus }) {
  // null 代表該組合沒有這項加成欄位，不顯示也不補 0。
  const rows = BONUS_ROWS.filter((row) => bonus[row.key] != null && bonus[row.key] !== 0);
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">此組合在資料中沒有任何加成欄位值。</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">加成欄位</p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-mono tabular-nums">{bonus[row.key]!.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
