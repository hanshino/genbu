import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { SevenStarSolver } from "@/components/tools/seven-star-solver";

export const metadata: Metadata = {
  title: "175 北斗七星 | Genbu",
  description: "北斗七星開關解題器。",
};

export default function SevenStarPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools" />
      </nav>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold">175 副本 — 北斗七星</h1>
      </header>
      <SevenStarSolver />
    </div>
  );
}
