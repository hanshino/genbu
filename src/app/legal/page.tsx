import type { Metadata } from "next";
import Link from "next/link";
import { BadgeInfoIcon, CopyrightIcon, MailIcon, CalculatorIcon, LockIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "免責與著作權聲明 | 玄武",
  description: "玄武為非官方、非營利的武林同萌傳玩家資料站；著作權歸屬、權利人下架聯絡與隱私說明。",
};

const CONTACT_EMAIL = "genbu@hanshino.dev";
const LAST_UPDATED = "2026-10-24";

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          免責與著作權聲明
        </h1>
        <p className="text-muted-foreground mt-3 text-xs">最後更新：{LAST_UPDATED}</p>
      </header>

      <Separator className="my-8" />

      <div className="space-y-10">
        <Section icon={BadgeInfoIcon} title="非官方聲明">
          <p>
            玄武是玩家個人製作的非官方、非營利查詢網站，與《武林同萌傳》的開發商、營運商及其關係企業沒有任何隸屬、授權或合作關係。
          </p>
        </Section>

        <Section icon={CopyrightIcon} title="著作權聲明">
          <p>
            站內使用的遊戲名稱、圖示、美術素材與遊戲設定資料，均取自《武林同萌傳》遊戲，其著作權及相關權利皆屬原權利人所有。
          </p>
          <p>
            本站僅以介紹、查詢與研究為目的展示上述內容：不收取任何費用、不刊登廣告，也不提供遊戲檔案或素材的下載。
          </p>
        </Section>

        <Section icon={MailIcon} title="權利人聯絡與下架">
          <p>
            若您是相關權利人，認為本站內容侵害您的權益，請來信{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-foreground font-medium underline underline-offset-4 hover:text-primary"
            >
              {CONTACT_EMAIL}
            </a>
            ，並註明內容所在的網址與權利說明。
          </p>
          <p>本站會在收到通知後 3 個工作天內先行移除相關內容，再與您聯繫。</p>
        </Section>

        <Section icon={CalculatorIcon} title="資料正確性">
          <p>
            站內數值、公式與計算結果為整理推算所得，僅供參考；與遊戲內實際表現不同時，以遊戲內顯示為準。
            發現錯誤歡迎透過{" "}
            <Link
              href="/about"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              關於頁
            </Link>
            的管道回報。
          </p>
        </Section>

        <Section icon={LockIcon} title="隱私">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              LINE 登入只取得用來辨識帳號的識別碼（openid），不會取得您的
              email、頭像或好友資料；站內另外只保存您自訂的暱稱。
            </li>
            <li>
              登入後保存的資料僅限您主動送出的內容：市集價格回報、投票與放置小遊戲進度，不會提供給第三方。
            </li>
            <li>流量統計使用自架的 Umami，不使用追蹤型 cookie，也不記錄可辨識個人身分的資訊。</li>
            <li>市集擺攤資料中的賣家角色名稱只以雜湊值保存，不保存原始名稱。</li>
            <li>如需刪除帳號與相關資料，請來信上述信箱。</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-heading mb-3 flex items-center gap-2 text-xl font-bold">
        <Icon className="text-primary size-5" aria-hidden />
        {title}
      </h2>
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
