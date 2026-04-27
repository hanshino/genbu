import Link from "next/link";

interface LinkListSectionProps {
  title: string;
  summary?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function LinkListSection({ title, summary, footer, children }: LinkListSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {summary != null && <span className="text-xs text-muted-foreground">{summary}</span>}
      </div>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {children}
      </ul>
      {footer != null && <p className="text-xs text-muted-foreground">{footer}</p>}
    </section>
  );
}

interface LinkListRowProps {
  href: string;
  children: React.ReactNode;
}

export function LinkListRow({ href, children }: LinkListRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/50"
      >
        {children}
      </Link>
    </li>
  );
}
