import manifest from "./generated/equipment-images.json";

export interface EquipmentImage {
  src: string;
  width: number;
  height: number;
  sourceUrl: string;
}

interface RawEntry {
  src: string;
  width: number | null;
  height: number | null;
  sourceUrl: string;
}

const entries = manifest as Record<string, RawEntry>;

export function imageOfItem(item: { id: number }): EquipmentImage | null {
  const raw = entries[String(item.id)];
  if (!raw) return null;
  return {
    src: raw.src,
    width: raw.width ?? 400,
    height: raw.height ?? 300,
    sourceUrl: raw.sourceUrl,
  };
}
