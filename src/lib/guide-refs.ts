import { getItemById } from "@/lib/queries/items";
import { getStageDetail } from "@/lib/queries/stages";
import { getMonsterById } from "@/lib/queries/monsters";
import { getSkillById } from "@/lib/queries/magic";
import { getGroupForType, ITEM_TYPE_LABELS } from "@/lib/constants/item-types";
import { monsterTypeLabel } from "@/lib/constants/monster-type";
import { magicClanListLabel } from "@/lib/constants/magic-clan";

export type GuideRefKind = "item" | "map" | "monster" | "skill";

export interface GuideRef {
  kind: GuideRefKind;
  id: number;
  name: string;
  /** 1–3 個短事實，供內文小卡顯示。 */
  facts: string[];
  href: string;
}

function getItemRef(id: number): GuideRef | null {
  const item = getItemById(id);
  if (!item) return null;
  const facts: string[] = [];
  if (item.type) {
    const label = ITEM_TYPE_LABELS[item.type] ?? getGroupForType(item.type)?.label ?? item.type;
    facts.push(label);
  }
  if (item.level > 0) facts.push(`等級需求 ${item.level}`);
  return { kind: "item", id, name: item.name, facts: facts.slice(0, 3), href: `/items/${id}` };
}

function getMapRef(id: number): GuideRef | null {
  const stage = getStageDetail(id);
  if (!stage || !stage.name) return null;
  const facts: string[] = [];
  if (stage.group != null) facts.push(`GROUP ${stage.group}`);
  return { kind: "map", id, name: stage.name, facts: facts.slice(0, 3), href: `/maps/${id}` };
}

function getMonsterRef(id: number): GuideRef | null {
  const monster = getMonsterById(id);
  if (!monster) return null;
  const facts: string[] = [`等級 ${monster.level}`];
  const typeLabel = monsterTypeLabel(monster.type);
  if (typeLabel !== "—") facts.push(typeLabel);
  return {
    kind: "monster",
    id,
    name: monster.name,
    facts: facts.slice(0, 3),
    href: `/monsters/${id}`,
  };
}

function getSkillRef(id: number): GuideRef | null {
  const rows = getSkillById(id);
  if (rows.length === 0) return null;
  const first = rows[0];
  const facts: string[] = [];
  const { label } = magicClanListLabel(first.clan, first.skill_type);
  facts.push(label);
  const maxLevel = rows.reduce((m, r) => Math.max(m, r.level), 0);
  facts.push(`可點到 ${maxLevel} 級`);
  return { kind: "skill", id, name: first.name, facts: facts.slice(0, 3), href: `/skills/${id}` };
}

export function getGuideRef(kind: GuideRefKind, id: number): GuideRef | null {
  if (!Number.isInteger(id) || id <= 0) return null;
  switch (kind) {
    case "item":
      return getItemRef(id);
    case "map":
      return getMapRef(id);
    case "monster":
      return getMonsterRef(id);
    case "skill":
      return getSkillRef(id);
  }
}
