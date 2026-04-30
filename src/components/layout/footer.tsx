import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>玄武 · 武林同萌傳資料庫</p>
        <div className="flex items-center gap-3">
          <Link href="/about" className="hover:text-foreground transition-colors">
            關於
          </Link>
          <span aria-hidden>·</span>
          <p>非官方查詢站，資料僅供參考</p>
        </div>
      </div>
    </footer>
  );
}
