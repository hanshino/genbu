import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  href: string;
  title: string;
  subtitle: string;
  description: string;
};

export function ToolCard({ href, title, subtitle, description }: Props) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          <CardDescription className="text-base text-foreground/80">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">{description}</CardContent>
      </Card>
    </Link>
  );
}
