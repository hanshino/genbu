import { Badge } from "@/components/ui/badge";
import { monsterTypeLabel } from "@/lib/constants/monster-type";
import type { MonsterDetail } from "@/lib/types/monster";

interface MonsterDetailProps {
  monster: MonsterDetail;
}

interface AttrSection {
  title: string;
  rows: { label: string; value: number | null | undefined; unit?: string }[];
}

export function MonsterDetailView({ monster }: MonsterDetailProps) {
  const sections: AttrSection[] = [
    {
      title: "基本屬性",
      rows: [
        { label: "血量", value: monster.hp },
        { label: "基礎命中", value: monster.base_hit },
        { label: "基礎閃躲", value: monster.base_dodge },
        { label: "重擊", value: monster.critical_hit },
        { label: "拆招", value: monster.uncanny_dodge },
        { label: "經驗", value: monster.drop_exp },
        { label: "銀兩 (上限)", value: monster.drop_money_max },
      ],
    },
    {
      title: "傷害參數",
      rows: [
        { label: "傷害下限", value: monster.damage_min },
        { label: "傷害上限", value: monster.damage_max },
        { label: "內勁下限", value: monster.pDamage_min },
        { label: "內勁上限", value: monster.pDamage_max },
        { label: "攻速", value: monster.attack_speed },
        { label: "攻擊距離", value: monster.attack_range },
      ],
    },
    {
      title: "防禦參數",
      rows: [
        { label: "防禦", value: monster.extra_def },
        { label: "護勁", value: monster.magic_def },
        { label: "火抗", value: monster.fire_def },
        { label: "水抗", value: monster.water_def },
        { label: "雷抗", value: monster.lightning_def },
        { label: "木抗", value: monster.wood_def },
      ],
    },
    {
      title: "狀態抗性",
      rows: [
        { label: "上狀態機率", value: monster.status_prob },
        { label: "虛弱抗性", value: monster.weaken_res },
        { label: "僵直抗性", value: monster.stun_res },
        { label: "形狀抗性", value: monster.shape_res },
        { label: "出血抗性", value: monster.bleed_res },
      ],
    },
    {
      title: "六圍",
      rows: [
        { label: "外功", value: monster.str },
        { label: "內力", value: monster.pow },
        { label: "根骨", value: monster.vit },
        { label: "技巧", value: monster.dex },
        { label: "身法", value: monster.agi },
        { label: "玄學", value: monster.wis },
      ],
    },
  ];

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{monster.name}</h1>
          {monster.type != null && (
            <Badge variant="secondary" className="font-normal">
              {monsterTypeLabel(monster.type)}
            </Badge>
          )}
          {monster.elemental && (
            <Badge variant="outline" className="font-normal">
              {monster.elemental}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-mono">#{monster.id}</span>
          <span>等級 {monster.level}</span>
          {monster.elemental_attack != null && monster.elemental_attack !== 0 && (
            <span>屬性攻擊 {monster.elemental_attack}</span>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <AttrCard key={section.title} section={section} />
        ))}
      </div>
    </section>
  );
}

function AttrCard({ section }: { section: AttrSection }) {
  const visibleRows = section.rows.filter((r) => r.value != null && r.value !== 0);
  if (visibleRows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-2 text-sm font-medium">{section.title}</div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-4 text-sm">
        {visibleRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-b border-dashed border-border/40 pb-1 last:border-0 last:pb-0"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-mono tabular-nums">
              {row.value != null ? row.value.toLocaleString() : "—"}
              {row.unit && <span className="ml-0.5 text-xs text-muted-foreground">{row.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
