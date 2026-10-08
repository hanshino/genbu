import Script from "next/script";

const UMAMI_SCRIPT_URL = "https://umami.hanshino.dev/script.js";
const UMAMI_WEBSITE_ID = "99829e61-6032-408d-937f-71b8d421997a";

// ponytail: query-only navigation no longer counts as a pageview.
const beforeSendScript = `(() => {
  let lastPath;
  window.__umamiBeforeSend = (type, payload) => {
    if (type !== "event" || "name" in payload) return payload;
    const path = new URL(payload.url, window.location.href).pathname;
    if (path === lastPath) return false;
    lastPath = path;
    return payload;
  };
})();`;

export function UmamiAnalytics() {
  return (
    <>
      <script id="umami-before-send" dangerouslySetInnerHTML={{ __html: beforeSendScript }} />
      <Script
        src={UMAMI_SCRIPT_URL}
        data-website-id={UMAMI_WEBSITE_ID}
        data-before-send="__umamiBeforeSend"
        strategy="afterInteractive"
      />
    </>
  );
}
