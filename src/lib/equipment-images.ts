import manifest from "./generated/equipment-images.json";

export interface EquipmentImage {
  src: string;
  sourceUrl: string;
}

const entries = manifest as Record<string, EquipmentImage>;

export function imageOfItem(item: { id: number }): EquipmentImage | null {
  return entries[String(item.id)] ?? null;
}
