import { UserIcon } from "lucide-react";
import { EntityPortrait } from "@/components/common/entity-portrait";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";

/** 任務頁的 NPC 小立繪；查無圖時放同尺寸的人形佔位，讓列對齊。預設 size-9，用 className 覆寫尺寸。 */
export function NpcPortrait({
  image,
  name,
  className,
}: {
  image: EntityImage | null | undefined;
  name: string;
  className?: string;
}) {
  if (image) return <EntityPortrait image={image} alt={name} size="sm" className={className} />;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 text-muted-foreground/70",
        className,
      )}
    >
      <UserIcon className="size-1/2" />
    </span>
  );
}

/** 立繪 + 名字，一排可多個（接取／交付、流程步驟共用）。 */
export function NpcList({
  names,
  images,
  portraitClassName = "size-8",
}: {
  names: string[];
  images: Record<string, EntityImage | null>;
  portraitClassName?: string;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {names.map((n) => (
        <li key={n} className="inline-flex items-center gap-2">
          <NpcPortrait image={images[n]} name={n} className={portraitClassName} />
          <span>{n}</span>
        </li>
      ))}
    </ul>
  );
}
