import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>玄武</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/about" className="hover:text-foreground transition-colors">
            關於
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal" className="hover:text-foreground transition-colors">
            免責聲明
          </Link>
          <span aria-hidden>·</span>
          <p>非官方非營利，素材著作權屬原權利人</p>
        </div>
      </div>
    </footer>
  );
}
