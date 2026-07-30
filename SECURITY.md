# Security checks

Automated scanning runs on every push and pull request via
`.github/workflows/security.yml`, plus a weekly scheduled run.

## What runs

| Command | Purpose |
| --- | --- |
| `bun run security:scan` | Static audit of `supabase/migrations/**` and `src/**` |
| `bun run security:deps` | `npm audit` for high/critical dependency advisories |

## Rules enforced (`scripts/security-scan.mjs`)

Errors (fail CI):

- `rls-disabled` — a `public` table is created without `ENABLE ROW LEVEL SECURITY`
- `rls-no-policy` — a table has RLS but no policy
- `missing-grant` — a table has no `GRANT`, so PostgREST returns permission errors
- `definer-search-path` — `SECURITY DEFINER` function without a pinned `search_path`
- `service-role-in-client-graph` — service-role key referenced from a client-reachable module
- `admin-client-static-import` — `supabase/client.server` imported at module scope
- `hardcoded-secret` / `secret-in-sql` — literal keys or JWTs committed to the repo

Warnings (reported, do not fail):

- `anon-grant` — a table granted to the `anon` role
- `permissive-policy` — a policy using `(true)`
- `admin-client-usage` — `supabaseAdmin` used outside a dynamic import

Historical migrations may still emit warnings even when a later migration
revoked the grant; that's why these are warnings and not errors.

## Tuning

To mark a table as intentionally world-readable, add its name to
`PUBLIC_READ_ALLOWLIST` in `scripts/security-scan.mjs`.
