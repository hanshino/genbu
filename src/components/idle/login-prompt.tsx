import { loginHref } from "@/components/auth/account";
import { LineIcon } from "@/components/auth/line-icon";
import { TrackedLoginLink } from "@/components/auth/tracked-login-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** 沒登入時的提示：存檔在伺服器，所以要登入才能玩。 */
export function IdleLoginPrompt() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">登入後開始掛機</CardTitle>
        <CardDescription>進度存在伺服器，登入後離線時也會繼續累積經驗。</CardDescription>
      </CardHeader>
      <CardContent>
        {/* LINE 綠是全站唯一的品牌色例外，不走主題色票。 */}
        <TrackedLoginLink
          source="idle_page"
          href={loginHref("/idle")}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#06C755] text-[0.95rem] font-medium text-white shadow-sm transition-colors outline-none hover:bg-[#05A948] focus-visible:ring-3 focus-visible:ring-[#06C755]/45 active:translate-y-px"
        >
          <LineIcon className="size-5" />
          使用 LINE 登入
        </TrackedLoginLink>
      </CardContent>
    </Card>
  );
}
