import { GhostIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";

interface EntityPortraitProps {
  image: EntityImage | null | undefined;
  alt: string;
  /** sm 用於列表縮圖，md 用於卡片立繪帶，lg 用於詳情立繪。 */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "size-9",
  md: "h-16 w-14",
  lg: "h-40 w-40 sm:h-48 sm:w-48",
};

const FALLBACK_ICON_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "size-4",
  md: "size-5",
  lg: "size-10",
};

export function EntityPortrait({ image, alt, size = "lg", className }: EntityPortraitProps) {
  const frame = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30",
    SIZE_CLASS[size],
    className,
  );

  if (!image) {
    return (
      <span className={cn(frame, "text-muted-foreground")} aria-hidden>
        <GhostIcon className={FALLBACK_ICON_CLASS[size]} />
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlink 直連；走 next/image 會集中到 Vercel optimizer IP，對 img.hanshino.dev 反而更易被限流 */}
      <img
        src={image.url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
