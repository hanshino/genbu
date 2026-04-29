type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (name: string, props?: EventProps) => void;
    };
  }
}

export function track(name: string, props?: EventProps): void {
  if (typeof window === "undefined") return;
  window.umami?.track(name, props);
}
