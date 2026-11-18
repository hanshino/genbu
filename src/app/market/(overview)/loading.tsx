export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">市集</h1>
      <p role="status" className="text-sm text-muted-foreground motion-safe:animate-pulse">
        載入市集掛單…
      </p>
      <div className="h-64 rounded-lg border border-border/60 bg-muted/50 motion-safe:animate-pulse" />
    </div>
  );
}
