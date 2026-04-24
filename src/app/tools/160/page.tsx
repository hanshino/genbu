import type { Metadata } from "next";
import { ForestMatrixSolver } from "@/components/tools/forest-matrix-solver";

export const metadata: Metadata = {
  title: "160 迷霧九宮格 | Genbu",
  description: "迷霧九宮格九宮格魔方解題器。",
};

export default function ForestMatrixPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">160 副本 — 迷霧九宮格</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          選擇總和（12 或 15），點擊兩間關閉的房間輸入 NPC 給的水晶數，點「解題」即可推算其餘 7 間。
        </p>
      </header>
      <ForestMatrixSolver />
    </div>
  );
}
