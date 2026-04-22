"use client";

import Image from "next/image";
import {
  Dialog,
  DialogCloseButton,
  DialogDescription,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { EquipmentImage } from "@/lib/equipment-images";

interface Props {
  cover: EquipmentImage;
  alt: string;
}

export function ItemCover({ cover, alt }: Props) {
  const { width, height } = cover;
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`查看 ${alt} 放大圖`}
        className="group cursor-zoom-in rounded-lg border border-border/60 bg-card p-2 transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Image
          src={cover.src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 640px) 60vw, 200px"
          priority
          className="h-auto w-40 object-contain sm:w-52"
        />
      </DialogTrigger>
      <DialogPopup className="w-auto max-w-[min(90vw,720px)] p-4">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">放大檢視裝備圖</DialogDescription>
        <Image
          src={cover.src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 640px) 90vw, 720px"
          className="h-auto max-h-[80vh] w-auto max-w-full object-contain"
        />
        <DialogCloseButton />
      </DialogPopup>
    </Dialog>
  );
}
