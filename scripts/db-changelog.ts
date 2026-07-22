// 本地版本差異 → 更新日誌 JSON。
//
// 用法（務必「先跑腳本、再 commit 新 DB」）：
//   1. 用新的 tthol.sqlite 覆蓋工作區檔（尚未 git add）
//   2. npm run changelog -- 1.23 [--note "說明"]   （版本號＝第一個位置參數）
//      預設用本機 `claude -p`（走 Claude Code 訂閱登入身分，免 API key）跑 AI 策展；
//      --no-ai 略過；--sdk 改走 @anthropic-ai/sdk（需 .env 的 ANTHROPIC_API_KEY）；--model 換模型
//   3. review src/data/changelog/<date>-v1.23.json（highlights 可手改，改過把 ai.edited 設 true）
//   4. git add tthol.sqlite src/data/changelog/*.json && git commit
//
// 舊 DB 預設取自 git（HEAD:tthol.sqlite 的 blob）；用 spawn 直接把二進位
// pipe 進暫存檔，不經 shell 重導向（Windows 下 > 會破壞二進位）。

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import { diffDatabases, buildChangelogEntry } from "../src/lib/changelog/diff";
import { PROFILES } from "../src/lib/changelog/config";
import type { ChangelogEntry } from "../src/lib/changelog/types";
import { digestForAI } from "../src/lib/changelog/digest";
import {
  curateWithClaude,
  curationToAiLayer,
  resolveAiPlan,
  type CurationClient,
} from "../src/lib/changelog/curate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_FILE = "tthol.sqlite";
const OUT_DIR = path.join(PROJECT_ROOT, "src", "data", "changelog");

interface Args {
  version?: string;
  date: string;
  note?: string;
  from: string; // git ref 或檔案路徑
  to: string; // 檔案路徑
  force: boolean;
  noAi: boolean;
  sdk: boolean;
  model: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    date: new Date().toISOString().slice(0, 10),
    from: "HEAD",
    to: path.join(PROJECT_ROOT, DB_FILE),
    force: false,
    noAi: false,
    sdk: false,
    model: "claude-opus-4-8",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--no-ai") args.noAi = true;
    else if (a === "--sdk") args.sdk = true;
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--version") args.version = argv[++i];
    else if (a === "--date") args.date = argv[++i];
    else if (a === "--note") args.note = argv[++i];
    else if (a === "--from") args.from = argv[++i];
    else if (a === "--to") args.to = argv[++i];
    // 版本號為第一個位置參數：`npm run ... -- --version` 會被 npm 當成自己的
    // 全域旗標攔截（印 npm 版本就結束），故改用位置參數。--version 仍保留為
    // 直呼 tsx 時的相容別名。
    else if (!a.startsWith("--") && args.version === undefined) args.version = a;
  }
  return args;
}

function gitBlobToTemp(ref: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `tthol-old-${process.pid}.sqlite`);
    const out = fs.createWriteStream(tmp);
    const child = spawn("git", ["show", `${ref}:${DB_FILE}`], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
    });
    let err = "";
    let closed = false;
    let finished = false;
    let code: number | null = null;
    const fail = (err: Error) => {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* best effort */
      }
      reject(err);
    };
    const settle = () => {
      if (!(closed && finished)) return;
      if (code === 0) resolve(tmp);
      else fail(new Error(`git show ${ref}:${DB_FILE} 失敗：${err.trim()}`));
    };
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", fail);
    child.stdout.pipe(out);
    child.on("close", (c) => {
      code = c;
      closed = true;
      settle();
    });
    out.on("error", fail);
    out.on("finish", () => {
      finished = true;
      settle();
    });
  });
}

// 真 client：唯一碰 SDK 的地方。金鑰由 SDK 自 process.env.ANTHROPIC_API_KEY 讀取，
// 絕不寫進 prompt/log。structured output 用 json_schema 約束，取文字後 JSON.parse。
function anthropicClient(): CurationClient {
  const anthropic = new Anthropic();
  return {
    async curate({ model, system, user, schema }) {
      const res = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", schema: schema as Record<string, unknown> } },
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return JSON.parse(text);
    },
  };
}

// 去掉模型常見的 ```json … ``` 圍籬，並容錯地取第一個 { 到最後一個 }，
// 讓 CLI（無 json_schema 硬約束）的輸出仍能穩定 JSON.parse。
function stripFence(text: string): string {
  const t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = (fenced ? fenced[1] : t).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

// CLI client：走本機 `claude -p`（Claude Code 訂閱登入身分），不需 ANTHROPIC_API_KEY。
// system 以 --system-prompt 傳（shell:false → 多行參數不經 shell，無引號問題）；
// user（含 digest）走 stdin；--output-format json 取外層 envelope.result，去圍籬後 JSON.parse。
// schema 在此路徑不硬約束，靠系統提示 + stripFence + normalizeCuration 三層防禦。
function claudeCliClient(): CurationClient {
  return {
    curate({ model, system, user }) {
      return new Promise((resolve, reject) => {
        // 關鍵：把 ANTHROPIC_API_KEY / AUTH_TOKEN 從子行程環境剝掉。否則 .env 載入的
        // 金鑰會被 claude 當成 API 金鑰、蓋過 claude.ai 訂閱登入 → 認證失敗。
        const env = { ...process.env };
        delete env.ANTHROPIC_API_KEY;
        delete env.ANTHROPIC_AUTH_TOKEN;
        const child = spawn(
          "claude",
          [
            "-p",
            "--model",
            model,
            "--output-format",
            "json",
            "--system-prompt",
            system + "\n\n只輸出符合要求的 JSON 物件本身；不要 code fence、不要任何前後說明文字。",
          ],
          { cwd: PROJECT_ROOT, windowsHide: true, env },
        );
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d.toString()));
        child.stderr.on("data", (d) => (err += d.toString()));
        child.on("error", (e) =>
          reject(new Error(`無法啟動 claude CLI（是否已安裝並登入？）：${e.message}`)),
        );
        child.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`claude -p 失敗（exit ${code}）：${(err || out).trim()}`));
            return;
          }
          let envelope: { is_error?: boolean; subtype?: string; result?: unknown };
          try {
            envelope = JSON.parse(out);
          } catch {
            reject(new Error(`claude -p 輸出非預期 JSON envelope：${out.slice(0, 200)}`));
            return;
          }
          if (envelope.is_error || typeof envelope.result !== "string") {
            reject(new Error(`claude -p 回報錯誤：${envelope.subtype ?? String(envelope.result)}`));
            return;
          }
          try {
            resolve(JSON.parse(stripFence(envelope.result)));
          } catch (e) {
            reject(
              new Error(`claude -p 策展輸出無法解析為 JSON：${e instanceof Error ? e.message : String(e)}`),
            );
          }
        });
        child.stdin.write(user);
        child.stdin.end();
      });
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.version) {
    console.error(
      "用法：npm run changelog -- <版本號> [--date YYYY-MM-DD] [--note 說明] [--from HEAD|路徑] [--to 路徑] [--no-ai] [--sdk] [--model <id>] [--force]",
    );
    process.exit(1);
  }

  let oldPath: string;
  let cleanup: string | null = null;
  if (fs.existsSync(args.from)) {
    oldPath = args.from;
  } else {
    try {
      oldPath = await gitBlobToTemp(args.from);
      cleanup = oldPath;
    } catch (e) {
      console.error(String(e));
      console.error(`取不到舊 DB。若 HEAD 尚無 ${DB_FILE}，請用 --from <舊檔路徑>。`);
      process.exit(1);
    }
  }

  let oldDb: Database.Database | undefined;
  let newDb: Database.Database | undefined;
  let entry: ChangelogEntry | null;
  try {
    oldDb = new Database(oldPath, { readonly: true });
    newDb = new Database(args.to, { readonly: true, fileMustExist: true });
    const diff = diffDatabases(oldDb, newDb, PROFILES);
    entry = buildChangelogEntry(diff, { version: args.version, date: args.date, note: args.note });
  } finally {
    oldDb?.close();
    newDb?.close();
    if (cleanup) fs.rmSync(cleanup, { force: true });
  }
  if (!entry) {
    console.error("新舊 DB 無語意差異（或 HEAD 已是新檔）。未寫檔。");
    process.exit(1);
  }

  const outFile = path.join(OUT_DIR, `${args.date}-v${args.version}.json`);
  if (fs.existsSync(outFile) && !args.force) {
    console.error(`檔案已存在：${path.relative(PROJECT_ROOT, outFile)}（加 --force 覆寫）`);
    process.exit(1);
  }

  // ── AI 策展（可降級）──────────────────────────────
  const plan = resolveAiPlan({ noAi: args.noAi, useSdk: args.sdk, apiKey: process.env.ANTHROPIC_API_KEY });
  if (plan.runAi) {
    const via = args.sdk ? "SDK" : "claude -p";
    try {
      const client = args.sdk ? anthropicClient() : claudeCliClient();
      // entry 結構滿足 digestForAI 的 DbDiff 形參（summary/addedTables/removedTables/tables）
      const curation = await curateWithClaude(digestForAI(entry), {
        client,
        model: args.model,
      });
      entry.ai = curationToAiLayer(curation, { model: args.model, edited: false });
      console.log(`\n本版重點（AI 策展，${via}／${args.model}，請 review）：`);
      for (const h of entry.ai.highlights) console.log("  • " + h);
    } catch (e) {
      console.warn(
        `\n[警告] AI 策展失敗（${via}），僅輸出事實層：` +
          (e instanceof Error ? (e.stack ?? e.message) : String(e)),
      );
    }
  } else {
    console.log(`\n[提示] 略過 AI 策展（${plan.reason}）。`);
  }
  // ─────────────────────────────────────────────────

  await fsp.mkdir(OUT_DIR, { recursive: true });
  await fsp.writeFile(outFile, JSON.stringify(entry, null, 2) + "\n", "utf8");

  console.log(`\n更新日誌 v${args.version}（${args.date}）`);
  console.log(`  總計：+${entry.summary.added} ~${entry.summary.changed} −${entry.summary.removed}`);
  if (entry.addedTables.length) console.log(`  新增表：${entry.addedTables.join(", ")}`);
  if (entry.removedTables.length) console.log(`  移除表：${entry.removedTables.join(", ")}`);
  for (const t of entry.tables) {
    const flags = [
      t.rebuilt ? "重建" : "",
      t.noIdentity ? "無識別" : "",
      t.structural ? "結構變動" : "",
      t.systematic?.length ? `系統性x${t.systematic.length}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `  ${t.label}(${t.table})  +${t.counts.added} ~${t.counts.changed} −${t.counts.removed}` +
        (flags ? `  [${flags}]` : ""),
    );
  }
  console.log(`\n已寫入 ${path.relative(PROJECT_ROOT, outFile)}`);
  console.log("請 review 內容（可手改 note），再：");
  console.log(`  git add ${DB_FILE} src/data/changelog/*.json && git commit`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
