import Link from "next/link";
import { TrackedLink } from "@/components/common/tracked-link";

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
  /** 有給才走 TrackedLink；沒有埋點需求的呼叫端維持純 next/link，不多耗一個 client 元件。 */
  event?: string;
  eventProps?: Record<string, string | number | boolean>;
}

export function LinkListRow({ href, children, event, eventProps }: LinkListRowProps) {
  const className =
    "flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/50";
  return (
    <li>
      {event ? (
        <TrackedLink href={href} event={event} eventProps={eventProps} className={className}>
          {children}
        </TrackedLink>
      ) : (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
    </li>
  );
}
