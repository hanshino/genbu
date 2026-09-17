import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { IdentityTag } from "@/components/auth/account";
import { NicknameForm } from "@/components/auth/nickname-form";

export const metadata: Metadata = {
  title: "個人設定 | 玄武",
  robots: { index: false, follow: false },
};

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?returnTo=%2Fme");

  return (
    <div className="px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 sm:mb-8">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">個人設定</h1>
          <p className="text-muted-foreground mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm sm:mt-2">
            <span>目前身分</span>
            <span className="text-foreground">{user.nickname}</span>
            <IdentityTag tag={user.tag} className="text-xs" />
          </p>
        </header>

        {/* 之後往下加「我的回報 / 我投過的票」直接接在這個 stack 裡，不用重排。 */}
        <div className="space-y-4">
          <section className="bg-card ring-foreground/10 rounded-xl p-5 shadow-sm ring-1 sm:p-6">
            <h2 className="font-heading text-base font-bold sm:text-lg">暱稱</h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              你回報市價時，其他玩家會看到這個名字。
            </p>
            <NicknameForm user={{ nickname: user.nickname, tag: user.tag }} />
          </section>
        </div>
      </div>
    </div>
  );
}
