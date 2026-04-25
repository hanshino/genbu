import type { Metadata } from "next";
import { GodQuestSolver } from "@/components/tools/god-quest-solver";
import { ToolsBreadcrumb } from "@/components/tools/tools-breadcrumb";

export const metadata: Metadata = {
  title: "180 神武禁地 | Genbu",
  description: "神武禁地解題器。",
};

export default function GodQuestPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ToolsBreadcrumb current="180 神武禁地" />
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">180 副本 — 神武禁地</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          9 格排成三角形，每邊 4 格總和相同，1~9 各用一次，封印數字固定在左上中。輸入總和與封印數字，列出所有合法解。
        </p>
      </header>
      <GodQuestSolver />
    </div>
  );
}
