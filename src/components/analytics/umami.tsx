import Script from "next/script";

const UMAMI_SCRIPT_URL = "https://umami.hanshino.dev/script.js";
const UMAMI_WEBSITE_ID = "99829e61-6032-408d-937f-71b8d421997a";

export function UmamiAnalytics() {
  return (
    <Script
      src={UMAMI_SCRIPT_URL}
      data-website-id={UMAMI_WEBSITE_ID}
      strategy="afterInteractive"
    />
  );
}
