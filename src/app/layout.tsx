import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CompareBar } from "@/components/compare/compare-bar";
import { UmamiAnalytics } from "@/components/analytics/umami";
import { getCurrentUser } from "@/lib/auth/session";

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-tc",
  display: "swap",
});

const notoSerifTC = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-serif-tc",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://genbu.hanshino.dev"),
  title: "玄武 · 武林同萌傳資料庫",
  description: "武林同萌傳 (TTHOL) 道具查詢、裝備比較、副本解謎工具",
};

// 在畫面繪製前套上主題，避免閃白；並在「跟隨系統」時即時跟著 OS 切換、同步其他分頁。
// localStorage "theme"：light | dark | 不存在 = 跟隨系統。寫入端在 components/layout/theme-toggle.tsx。
const themeScript = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");function a(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&m.matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}a();m.addEventListener("change",a);addEventListener("storage",function(e){if(e.key==="theme")a()})}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${notoSansTC.variable} ${notoSerifTC.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Navbar user={user && { nickname: user.nickname, tag: user.tag }} />
        <main className="flex-1">{children}</main>
        <Footer />
        <CompareBar />
        <UmamiAnalytics />
      </body>
    </html>
  );
}
