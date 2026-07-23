import { GhostIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";

interface EntityPortraitProps {
  image: EntityImage | null | undefined;
  alt: string;
  /** sm 用於列表縮圖，lg 用於詳情立繪。 */
  size?: "sm" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<"sm" | "lg", string> = {
  sm: "size-9",
  lg: "h-40 w-40 sm:h-48 sm:w-48",
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
        <GhostIcon className={size === "sm" ? "size-4" : "size-10"} />
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
