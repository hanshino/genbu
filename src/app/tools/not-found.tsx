import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ToolsNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-bold">找不到這個工具</h1>
      <p className="text-muted-foreground mt-2 text-sm">目前只支援 160 / 175 / 180 三個副本。</p>
      <Link href="/tools" className={cn(buttonVariants({ variant: "default" }), "mt-6")}>
        回到工具列表
      </Link>
    </div>
  );
}
