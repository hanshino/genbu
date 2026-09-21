import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldIcon } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/line";
import { loginHref } from "@/components/auth/account";
import { LineIcon } from "@/components/auth/line-icon";
import { TrackedLoginLink } from "@/components/auth/tracked-login-link";

export const metadata: Metadata = {
  title: "登入 | 玄武",
  description: "使用 LINE 登入玄武，回報武林同萌傳的道具市價。",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);

  // 已登入就沒有停在登入頁的理由。
  if (await getSession()) redirect(returnTo);

  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12 sm:py-16">
      <div className="bg-card ring-foreground/10 w-full max-w-sm rounded-xl p-6 shadow-sm ring-1 sm:p-8">
        <div className="flex items-baseline justify-center gap-2">
          <span className="font-heading text-primary text-2xl font-bold">玄武</span>
          <span className="text-muted-foreground text-xs">Genbu</span>
        </div>

        <h1 className="font-heading mt-5 text-center text-lg font-bold sm:mt-6 sm:text-xl">
          使用 LINE 登入以回報市價
        </h1>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed sm:mt-2.5">
          登入後才能回報道具價格、為別人的回報投票。單純查資料不用登入。
        </p>

        {/* LINE 綠是全站唯一的品牌色例外，不走主題色票。 */}
        <TrackedLoginLink
          source="login_page"
          href={loginHref(returnTo)}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#06C755] text-[0.95rem] font-medium text-white shadow-sm transition-colors outline-none hover:bg-[#05A948] focus-visible:ring-3 focus-visible:ring-[#06C755]/45 active:translate-y-px sm:mt-7"
        >
          <LineIcon className="size-5" />
          使用 LINE 登入
        </TrackedLoginLink>

        <div className="border-border bg-muted/70 mt-4 flex items-start gap-2.5 rounded-md border px-3 py-2.5 sm:mt-5 sm:px-3.5 sm:py-3">
          <ShieldIcon className="text-muted-foreground mt-px size-4 shrink-0" aria-hidden />
          <p className="text-muted-foreground text-xs leading-relaxed">
            我們只取得識別碼，
            <span className="text-foreground font-medium">不會取得你的 LINE 名稱或頭像</span>。
          </p>
        </div>
      </div>
    </div>
  );
}
