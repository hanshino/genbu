import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  href: string;
  title: string;
  description?: string;
};

export function ToolCard({ href, title, description }: Props) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
        </CardHeader>
        {description && (
          <CardContent className="text-muted-foreground text-sm">{description}</CardContent>
        )}
      </Card>
    </Link>
  );
}
