import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Regression guard: Next.js App Router rewrites `"use client"` modules into
// client-reference proxies. When a Server Component imports a primitive/object
// constant (or a value re-export) from a `"use client"` file, it receives a
// function proxy instead of the actual value. Arithmetic/slicing with that
// proxy silently coerces to NaN/0 and produces subtle runtime bugs.
//
// This test enforces the convention: `"use client"` modules expose only
// React-side APIs (hooks, components, types). All shared constants/helpers
// that Server Components might import must live in a plain module
// (e.g. `src/lib/constants/`, `src/lib/queries/`, `src/lib/scoring/`).

const SRC = join(process.cwd(), "src");

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function hasUseClientDirective(content: string): boolean {
  const firstNonComment = content
    .split("\n")
    .find((l) => l.trim() !== "" && !l.trim().startsWith("//") && !l.trim().startsWith("/*"));
  return /^\s*["']use client["'];?/.test(firstNonComment ?? "");
}

interface Violation {
  kind: "const" | "let" | "var" | "re-export";
  name: string;
}

function findValueExports(content: string): Violation[] {
  const out: Violation[] = [];

  // `export const X = ...`, `export let X = ...`, `export var X = ...`
  // Flag unless the RHS is clearly a function expression (arrow or `function`).
  for (const m of content.matchAll(
    /^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(.*)$/gm
  )) {
    const [, kind, name, rhs] = m;
    const isFn =
      /^\s*(async\s+)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+?)?=>/.test(rhs) ||
      /^\s*(async\s+)?function\b/.test(rhs);
    if (!isFn) out.push({ kind: kind as Violation["kind"], name });
  }

  // `export { X, Y as Z } from "..."` — value re-exports leak through the
  // same client-reference boundary even if the underlying module is plain.
  // Skip `export type { ... } from "..."` (type-only, erased at build).
  // Skip inline `{ type X, ...}` entries (type-only inside a value re-export).
  for (const m of content.matchAll(/^export\s+(type\s+)?\{([^}]+)\}\s+from\s+["'][^"']+["']/gm)) {
    if (m[1]) continue;
    for (const raw of m[2].split(",")) {
      const entry = raw.trim();
      if (entry === "" || entry.startsWith("type ")) continue;
      const name = entry.split(/\s+as\s+/).pop();
      if (name) out.push({ kind: "re-export", name });
    }
  }

  return out;
}

describe("use-client module boundary discipline", () => {
  const files = walkSourceFiles(SRC);

  const clientFiles = files.filter((f) => hasUseClientDirective(readFileSync(f, "utf8")));

  it("finds at least some client modules (sanity check)", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  for (const file of clientFiles) {
    const rel = file.slice(SRC.length + 1).replaceAll("\\", "/");
    it(`${rel} exports only hooks/components/types (no value exports)`, () => {
      const content = readFileSync(file, "utf8");
      const violations = findValueExports(content);
      expect(
        violations,
        `"use client" file exports non-function values that become client-reference ` +
          `proxies when imported from Server Components. Move these to a plain ` +
          `module (e.g. src/lib/constants/). Violations: ${violations
            .map((v) => `${v.kind} ${v.name}`)
            .join(", ")}`
      ).toEqual([]);
    });
  }
});
