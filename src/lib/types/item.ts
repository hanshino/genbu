export interface Item {
  id: number;
  name: string;
  note: string | null;
  type: string | null;
  summary: string | null;
  level: number;
  weight: number;
  hp: number;
  mp: number;
  str: number;
  pow: number;
  vit: number;
  dex: number;
  agi: number;
  wis: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  dodge: number;
  uncanny_dodge: number;
  critical: number;
  hit: number;
  speed: number;
  fire: number;
  water: number;
  thunder: number;
  tree: number;
  freeze: number;
  min_damage: number;
  max_damage: number;
  min_pdamage: number;
  max_pdamage: number;
  picture: number;
  icon: number;
  value: number;
  durability: number;
}

// item_rand.id 在 DB schema 為 varchar(255)，存放的是道具 ID 的字串形式
export interface ItemRand {
  id: string;
  attribute: string;
  max: number;
  min: number;
  rate: number;
}

export interface ItemRandDisplay extends ItemRand {
  probability: number; // percentage 0-100
  attributeLabel: string;
}
