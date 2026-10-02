import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon } from "lucide-react";
import { BackLink } from "@/components/common/back-link";
import { MeridianSimulator } from "@/components/meridian/meridian-simulator";
import { getMeridianData } from "@/lib/queries/meridian";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "經脈模擬器 · 玄武",
  description: "體驗打通經脈的機率與花費，或直接規劃一套配點，看屬性總和與要準備多少丹田。",
  alternates: { canonical: "/tools/meridian" },
};

export default function MeridianPage() {
  const data = getMeridianData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <BackLink href="/tools" />
      </div>

      <header>
        <h1 className="font-heading text-2xl font-bold tracking-wide md:text-3xl">經脈模擬器</h1>
        <p className="mt-2 text-base">還沒到 180 等，也能先試試經脈怎麼點。</p>
        <p className="mt-2.5 max-w-[62ch] text-[0.8rem] leading-relaxed text-muted-foreground">
          穴位、花費、成功率、前置條件與屬性加成都取自遊戲客戶端的資料檔。天突、膻中的「穴位成功率提高」客戶端沒寫是加百分點還是乘倍率，這裡一律
          <b className="font-medium text-foreground">當成加百分點</b>
          ，用到它的數字都會標「推估」；含失敗的平均花費也只是估算。
        </p>
        <Link
          href="/guides/meridian"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          <BookOpenIcon className="size-4" aria-hidden />
          經脈攻略：怎麼取得、先點哪裡
        </Link>
      </header>

      <MeridianSimulator data={data} />

      <footer className="mt-10 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
        資料來源：武林同萌傳客戶端資料檔，介面圖片為遊戲原圖。打通失敗一樣會扣丹田、氣海 +1，氣海滿 100 時下一次保證成功，這些照遊戲官方說明與實際遊玩模擬；標有「推估」「平均估算」的數字請當參考，不要當保證。
      </footer>
    </div>
  );
}
