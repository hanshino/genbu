import type { Metadata } from "next";
import { BackLink } from "@/components/common/back-link";
import { StatSimClient } from "@/components/stat-sim/stat-sim-client";
import { getStatSimData, getStatSimWindows } from "@/lib/queries/stat-sim";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "屬性模擬器 · 玄武",
  description: "建立自己的角色：門派、等級、轉生、配點、裝備與被動，算出跟遊戲一致的角色面板。",
  alternates: { canonical: "/tools/stat-sim" },
};

export default function StatSimPage() {
  // ponytail: 整包遊戲資料（約 830KB JSON / 105KB gzip）一次傳給 client；
  // 太慢再改成依部位延遲載入道具清單。
  const data = getStatSimData();
  const windows = getStatSimWindows();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools" />
      </div>

      <header className="mb-5">
        <h1 className="font-heading text-2xl font-bold tracking-wide md:text-3xl">屬性模擬器</h1>
        <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
          填入門派、等級、轉生、配點、裝備與被動，算出角色面板，並列出每一項數值的來源。角色資料只存在這台裝置的瀏覽器裡。
        </p>
      </header>

      <StatSimClient data={data} windows={windows} />

      <footer className="mt-10 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
        公式是用遊戲內實測資料推出來的；標「估」「近似」的數字和遊戲可能有落差，請當參考。經脈與進階屬性（抗性、回復）目前還沒計入。
      </footer>
    </div>
  );
}
