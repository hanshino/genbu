import type { Metadata } from "next";
import { IdleGame } from "@/components/idle/idle-game";
import { IdleLoginPrompt } from "@/components/idle/login-prompt";
import { TrialBadge } from "@/components/idle/trial-label";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "摸魚練功房 | 玄武",
  description: "放置型的武林同萌傳：角色自動找怪、打怪，離線也會累積經驗。",
  robots: { index: false, follow: false },
};

export default async function IdlePage() {
  const session = await getSession();
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:py-8">
      {session ? (
        <IdleGame />
      ) : (
        <div className="py-8 sm:py-12">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <h1 className="font-heading text-center text-2xl font-black tracking-wide sm:text-3xl">
              摸魚練功房
            </h1>
            <TrialBadge />
          </div>
          <IdleLoginPrompt />
        </div>
      )}
    </div>
  );
}
