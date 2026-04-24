import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { magicClanLabel } from "@/lib/constants/magic-clan";
import type { MagicSummary } from "@/lib/types/magic";

interface RelatedSkillsProps {
  clan: string;
  skills: MagicSummary[];
}

export function RelatedSkills({ clan, skills }: RelatedSkillsProps) {
  if (skills.length === 0) return null;

  return (
    <aside className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-2 text-sm font-medium">
        <span className="text-muted-foreground">同門派技能 · </span>
        <span>{magicClanLabel(clan)}</span>
      </div>
      <ul className="divide-y divide-border/60">
        {skills.map((s) => (
          <li key={`${s.id}-${s.name}`}>
            <Link
              href={`/skills/${s.id}?level=${s.firstLevel}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
            >
              <span className="truncate">{s.name}</span>
              <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">
                Lv {s.maxLevel}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
