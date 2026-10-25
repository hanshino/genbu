import type { Metadata } from "next";
import { ToolCard } from "@/components/tools/tool-card";
import { NAV_SECTIONS } from "@/lib/site-nav";

export const metadata: Metadata = {
  title: "工具總覽 | Genbu",
  description: "查詢強化配方、模擬屬性與經脈，以及副本解謎工具。",
  alternates: { canonical: "/tools" },
};

// 與 navbar、首頁同一份清單，不另外維護
const tools = NAV_SECTIONS.find((s) => s.overview === "/tools")!.items.filter(
  (e) => e.href !== "/tools",
);

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">工具總覽</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <ToolCard
            key={t.href}
            href={t.href}
            title={t.title ?? t.label}
            description={t.description}
          />
        ))}
      </div>
    </div>
  );
}
