import { PackageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityImage } from "@/lib/queries/images";

interface ItemIconProps {
  image: EntityImage | null | undefined;
  alt: string;
  /** 覆寫外框尺寸等；預設 size-8。 */
  className?: string;
  /** 像素風放大（詳情大圖用）。 */
  pixelated?: boolean;
}

export function ItemIcon({ image, alt, className, pixelated }: ItemIconProps) {
  const frame = cn(
    "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30",
    className,
  );

  if (!image) {
    return (
      <span className={cn(frame, "text-muted-foreground")} aria-hidden>
        <PackageIcon className="size-4" />
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
        className={cn("h-full w-full object-contain", pixelated && "[image-rendering:pixelated]")}
      />
    </span>
  );
}
