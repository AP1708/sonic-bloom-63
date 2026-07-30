## Goal

Your light/dark/system choice should survive reloads (already partly true via local storage) and follow you across devices when signed in.

## Current state (verified)

`ThemeProvider` (`src/components/theme/theme.tsx`) stores the choice only in `localStorage` under `theme`, with an inline pre-hydration script to avoid a flash. Nothing is written to the backend, so a second device starts from `system`.

## What to build

1. **Backend column**
   - Add `theme_preference text` to `profiles` (allowed values `light` / `dark` / `system`, default `system`). Existing RLS already lets users read/update their own profile row, so no new policies needed.

2. **Server access**
   - `src/lib/theme/theme.functions.ts`: `getThemePreference` and `setThemePreference` server functions using `requireSupabaseAuth`, reading/writing the signed-in user's `profiles` row. Value validated with zod.

3. **Provider changes** (`src/components/theme/theme.tsx`)
   - Keep local storage as the instant, offline source of truth and the pre-paint script unchanged (no flash).
   - On mount, if a session exists, fetch the stored preference; if it differs from local, adopt the remote value (last-write-wins, remote is treated as newer only when local has never been set OR the remote row was updated more recently — simplest rule: remote wins on fresh load, local wins for the rest of the session).
   - `setTheme` writes local storage immediately, then fires the server function in the background (silently ignored when signed out or offline).
   - Re-sync on `SIGNED_IN` so switching accounts picks up that account's preference.

4. **No UI changes** — the existing toggle and `/settings`-style theme control keep working; behaviour is just persistent.

## Technical notes

- Signed-out users are fully functional via local storage; the account write is best-effort and never blocks the UI.
- The time/season ambience system stays as-is; only the light/dark/system choice is persisted.
