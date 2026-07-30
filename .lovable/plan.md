## Goal

Let you control how newly discovered songs/artists animate in on the home feed — animation style, intensity, and timing — from a settings popover in the header and a full `/settings` page, with the choice synced to your account.

## What you'll get

**Settings surface**
- Gear button in the header (next to the theme toggle) opens a compact popover with the motion controls.
- New `/settings` page with sections: Appearance (existing theme toggle) and Discovery motion (the new controls), so it has room to grow.
- Both read/write the same preference, so they stay in sync instantly.

**Controls**
- Style: Rise (current fade + slide up), Fade only, Pop (scale), Slide in from side, Off.
- Intensity: slider 1–5 — scales travel distance, scale amount and the highlight strength.
- Timing: card duration slider (200–900ms), stagger between cards (0–120ms), and how long the "New" badge stays (4s / 12s / 30s / until next refresh).
- A "Preview" row of three mini cards inside the panel replays the animation whenever a control changes, so you can feel the setting without refreshing the feed.
- Reset to defaults button.

**Reduced motion**
- A "Respect system reduced-motion" switch, on by default. When on and the OS asks for reduced motion, all entrance animation is skipped and only a subtle static "New" badge shows.
- If you turn the switch off, your explicit choice wins — an intentional override, clearly labelled.

## Technical details

Storage
- Add a `motion_preference jsonb` column to `profiles` (default `{}`), storing `{ style, intensity, durationMs, staggerMs, badgeMs, respectReducedMotion }`. Migration includes the column plus a permissive-shape default; existing profile RLS/grants already cover it.
- `src/lib/motion/motion.functions.ts` — `getMotionPreference` / `setMotionPreference` server functions using `requireSupabaseAuth`, mirroring `theme.functions.ts`.

Client provider
- New `src/components/motion/motion-prefs.tsx`: `MotionPrefsProvider` + `useMotionPrefs`, mounted in `__root.tsx` next to `ThemeProvider`. Same pattern as the theme provider: read `localStorage` immediately (instant, works signed out), fetch the profile value on mount and reconcile, write through to Supabase in the background, and subscribe to the profile row via Realtime so a change on one device applies on others.
- Provider publishes CSS variables on `<html>`: `--anim-card-duration`, `--anim-card-stagger`, `--anim-card-shift`, `--anim-card-scale`, `--anim-badge-duration`, plus a `data-anim-style` attribute.

CSS
- Rewrite the `card-enter` / `fresh-pill` utilities in `src/styles.css` to read those variables instead of hard-coded values, and add per-style keyframes selected by `[data-anim-style="fade|pop|slide|rise"]`. Keep the `prefers-reduced-motion` block, but gate it on a `data-anim-reduced` attribute the provider sets so the override switch works.

Wiring
- `song-card.tsx` / `artist-card.tsx`: stagger delay becomes `calc(index * var(--anim-card-stagger))`; style/duration come from CSS, so no per-card JS logic.
- `useFreshMarkers` in `feed-store.ts` takes the badge duration from the provider instead of the fixed 12s constant (`until next refresh` = no timer).

Components
- `src/components/settings/motion-settings.tsx` — the control group, reused by the popover and the `/settings` page.
- `src/routes/settings.tsx` — public route (works signed out with local-only storage), with its own `head()` title/description.

## Verification

Playwright run on `/`: change style/intensity/timing in the popover, refresh the feed, and confirm the computed animation name, duration and delay on new cards match the chosen settings; then confirm reduced-motion emulation disables them while the override re-enables them.
