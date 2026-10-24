import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { ForestMatrixSolver } from "@/components/tools/forest-matrix-solver";

export const metadata: Metadata = {
  title: "160 迷霧九宮格 | Genbu",
  description: "迷霧九宮格九宮格魔方解題器。",
};

export default function ForestMatrixPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools" />
      </nav>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">160 副本 — 迷霧九宮格</h1>
      </header>
      <ForestMatrixSolver />
    </div>
  );
}
