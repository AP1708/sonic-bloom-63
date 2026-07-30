#!/usr/bin/env node
/**
 * IMUSIC static security scan.
 *
 * Catches the classes of problems we have already had to fix by hand:
 *  - public tables created without RLS / policies / GRANTs
 *  - tables or policies exposed to the `anon` role
 *  - policies that allow unrestricted access (`using (true)`)
 *  - service-role / admin client leaking into client-reachable modules
 *
 * Exit code 1 = at least one ERROR. Warnings never fail the build.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SRC_DIR = join(ROOT, "src");

const findings = [];
const add = (level, rule, file, message) =>
  findings.push({ level, rule, file, message });

/** Tables that are intentionally readable by anonymous visitors. */
const PUBLIC_READ_ALLOWLIST = new Set([]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------- migrations

function scanMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Aggregate across all migrations: later files can add RLS/policies/grants.
  const all = files
    .map((f) => ({ file: f, sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8") }))
    .map((m) => ({ ...m, lower: m.sql.toLowerCase() }));

  const combined = all.map((m) => m.lower).join("\n");

  const created = new Map(); // table -> first migration file
  for (const { file, lower } of all) {
    const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/g;
    let m;
    while ((m = re.exec(lower))) {
      if (!created.has(m[1])) created.set(m[1], file);
    }
  }

  for (const [table, file] of created) {
    const hasRls = new RegExp(
      `alter\\s+table\\s+(?:only\\s+)?(?:public\\.)?"?${table}"?[\\s\\S]{0,80}?enable\\s+row\\s+level\\s+security`,
    ).test(combined);
    if (!hasRls) {
      add("error", "rls-disabled", `supabase/migrations/${file}`,
        `Table public.${table} is created but never has ROW LEVEL SECURITY enabled.`);
    }

    const hasPolicy = new RegExp(`create\\s+policy[\\s\\S]{0,200}?on\\s+(?:public\\.)?"?${table}"?`).test(combined);
    if (!hasPolicy) {
      add("error", "rls-no-policy", `supabase/migrations/${file}`,
        `Table public.${table} has no CREATE POLICY — RLS with no policy blocks all access.`);
    }

    const hasGrant = new RegExp(`grant[\\s\\S]{0,120}?on\\s+(?:table\\s+)?(?:public\\.)?"?${table}"?`).test(combined);
    if (!hasGrant) {
      add("error", "missing-grant", `supabase/migrations/${file}`,
        `Table public.${table} has no GRANT statement — PostgREST will return a permission error.`);
    }
  }

  for (const { file, sql, lower } of all) {
    // anon exposure
    const grantAnon = /grant\s+[\s\S]{0,160}?\bto\b[^;\n]*\banon\b/g;
    let g;
    while ((g = grantAnon.exec(lower))) {
      const table = /on\s+(?:table\s+)?(?:public\.)?"?([a-z0-9_]+)"?/.exec(g[0])?.[1];
      // schema/function/sequence grants to anon are routine; only tables matter here
      if (!table || ["schema", "function", "sequence", "all"].includes(table)) continue;
      if (PUBLIC_READ_ALLOWLIST.has(table)) continue;
      add("warn", "anon-grant", `supabase/migrations/${file}`,
        `GRANT to anon on ${table} — confirm this data is meant to be world-readable.`);
    }

    // policies open to everyone
    const openPolicy = /create\s+policy\s+"?([a-z0-9_ -]+)"?[\s\S]{0,400}?(using|with\s+check)\s*\(\s*true\s*\)/g;
    let p;
    while ((p = openPolicy.exec(lower))) {
      const seg = p[0];
      const table = /on\s+(?:public\.)?"?([a-z0-9_]+)"?/.exec(seg)?.[1] ?? "unknown";
      if (PUBLIC_READ_ALLOWLIST.has(table)) continue;
      add("warn", "permissive-policy", `supabase/migrations/${file}`,
        `Policy "${p[1]}" on ${table} uses (true) — verify it does not expose other users' rows.`);
    }

    // security definer without pinned search_path
    const defRe = /create\s+(?:or\s+replace\s+)?function[\s\S]*?\$\$/g;
    let d;
    while ((d = defRe.exec(lower))) {
      if (d[0].includes("security definer") && !d[0].includes("search_path")) {
        add("error", "definer-search-path", `supabase/migrations/${file}`,
          "SECURITY DEFINER function without `SET search_path` — vulnerable to search_path hijacking.");
      }
    }

    if (/\bsb_secret_|service_role_key\s*=\s*['"]/.test(sql)) {
      add("error", "secret-in-sql", `supabase/migrations/${file}`, "Possible hardcoded service key in migration.");
    }
  }
}

// ---------------------------------------------------------------- app code

const CLIENT_REACHABLE = (f) =>
  !f.includes(".server.") && !f.includes("/server/") && !f.includes("/routes/api/");

function scanSource() {
  const files = walk(SRC_DIR).filter((f) => [".ts", ".tsx"].includes(extname(f)));
  for (const full of files) {
    const file = relative(ROOT, full);
    const code = readFileSync(full, "utf8");

    if (!CLIENT_REACHABLE(file)) continue;

    if (/SUPABASE_SERVICE_ROLE_KEY/.test(code)) {
      add("error", "service-role-in-client-graph", file,
        "Service role key referenced in a client-reachable module.");
    }

    // static import of the admin client from a client-reachable module
    const staticAdmin = /^\s*import\s[^\n]*from\s+["'][^"']*supabase\/client\.server["']/m;
    if (staticAdmin.test(code)) {
      add("error", "admin-client-static-import", file,
        "Static import of supabase/client.server — load it inside a handler with `await import(...)`.");
    }

    if (/supabaseAdmin/.test(code) && !/await import\(/.test(code)) {
      add("warn", "admin-client-usage", file,
        "Uses supabaseAdmin outside a dynamic import — verify the caller is authorized and server-only.");
    }

    // hardcoded long-lived secrets
    if (/(sb_secret_[A-Za-z0-9_-]{8,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)/.test(code)) {
      add("error", "hardcoded-secret", file, "Possible hardcoded secret/JWT in source.");
    }
  }
}

// ---------------------------------------------------------------- report

scanMigrations();
scanSource();

const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");

const icon = (l) => (l === "error" ? "✖" : "⚠");
for (const f of [...errors, ...warns]) {
  console.log(`${icon(f.level)} [${f.rule}] ${f.file}\n    ${f.message}`);
}

console.log(
  `\nSecurity scan complete: ${errors.length} error(s), ${warns.length} warning(s).`,
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const rows = [...errors, ...warns]
    .map((f) => `| ${icon(f.level)} | \`${f.rule}\` | \`${f.file}\` | ${f.message} |`)
    .join("\n");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Security scan\n\n${errors.length} error(s), ${warns.length} warning(s)\n\n` +
      (rows ? `| | Rule | File | Detail |\n|--|--|--|--|\n${rows}\n` : "No findings.\n"),
  );
}

process.exit(errors.length > 0 ? 1 : 0);
