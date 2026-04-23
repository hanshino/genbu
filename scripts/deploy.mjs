// Portainer deploy script
//
// 第一次執行：建立 git-backed stack（github.com/hanshino/genbu main），開啟 webhook redeploy
// 之後執行：用 token redeploy；webhook URL 會重新印出以便設定 CI
//
// 需要環境變數：PORTAINER_TOKEN（從 .env 載入；不要進版控）
//
// 使用： npm run deploy

import { randomUUID } from "node:crypto";

const HOST = "https://portainer.hanshino.dev";
const ENDPOINT_ID = 3; // "local"
const STACK_NAME = "genbu";
const GIT_URL = "https://github.com/hanshino/genbu";
const GIT_REF = "refs/heads/main";
const COMPOSE_FILE = "docker-compose.yml";

const token = process.env.PORTAINER_TOKEN;
if (!token) {
  console.error("✗ PORTAINER_TOKEN 未設定（放在 .env 裡，或用 node --env-file=.env 執行）");
  process.exit(1);
}

const headers = { "X-API-Key": token, "Content-Type": "application/json" };

async function api(method, path, body) {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`${method} ${path} → ${res.status} ${res.statusText}: ${detail}`);
  }
  return parsed;
}

function webhookUrl(uuid) {
  return `${HOST}/api/stacks/webhooks/${uuid}`;
}

async function findStack() {
  const stacks = await api("GET", "/api/stacks");
  return stacks.find((s) => s.Name === STACK_NAME) ?? null;
}

async function createStack() {
  const webhook = randomUUID();
  console.log(`→ 建立 stack「${STACK_NAME}」（${GIT_URL} @ ${GIT_REF}）`);
  const created = await api(
    "POST",
    `/api/stacks/create/standalone/repository?endpointId=${ENDPOINT_ID}`,
    {
      Name: STACK_NAME,
      RepositoryURL: GIT_URL,
      RepositoryReferenceName: GIT_REF,
      ComposeFile: COMPOSE_FILE,
      TLSSkipVerify: false,
      FromAppTemplate: false,
      Env: [],
      AutoUpdate: {
        Interval: "",
        Webhook: webhook,
        ForceUpdate: false,
        ForcePullImage: true,
      },
    },
  );
  console.log(`✓ 已建立：stack id = ${created.Id}`);
  return created;
}

async function redeployStack(stack) {
  console.log(`→ redeploy stack「${stack.Name}」(id=${stack.Id})`);
  await api("PUT", `/api/stacks/${stack.Id}/git/redeploy?endpointId=${ENDPOINT_ID}`, {
    env: [],
    prune: false,
    pullImage: true,
  });
  console.log(`✓ 已觸發 redeploy`);
}

async function printWebhook(stack) {
  const detail = await api("GET", `/api/stacks/${stack.Id}`);
  const uuid = detail?.AutoUpdate?.Webhook;
  if (!uuid) {
    console.log("⚠ 此 stack 尚未綁 webhook（透過 UI 建立的舊 stack 或未啟用）");
    return;
  }
  console.log("");
  console.log(`🔗 Webhook URL（放到 GitHub Secret: PORTAINER_WEBHOOK_URL）：`);
  console.log(`   ${webhookUrl(uuid)}`);
}

async function main() {
  const existing = await findStack();
  const stack = existing ?? (await createStack());
  if (existing) await redeployStack(existing);
  await printWebhook(stack);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
