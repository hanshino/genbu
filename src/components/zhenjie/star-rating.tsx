import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ stars, className }: { stars: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-px text-amber-500", className)}
      role="img"
      aria-label={`${stars} 星`}
    >
      {Array.from({ length: stars }, (_, i) => (
        <StarIcon key={i} className="size-3.5 fill-current" aria-hidden />
      ))}
    </span>
  );
}
