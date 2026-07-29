## Goal

Let each listener link their own Spotify and YouTube accounts from the top bar, import their playlists and liked songs into Sonance, and push playlist changes back to YouTube.

## What exists today

- Spotify: PKCE login already works (`spotify-auth.ts`, `use-spotify.ts`, `/spotify/callback`), surfaced as a "Connect Spotify" pill in the app shell. Token lives in browser storage; nothing is imported.
- YouTube: server-side API-key search only (`youtube.server.ts`). No per-user account concept at all.

## 1. Connection status in the top bar

Replace the single Spotify pill with a small "Connections" cluster: two pills (Spotify, YouTube) each showing linked / not-linked state, with a dropdown per pill offering Connect, Import now, Last synced …, and Disconnect. Compact icon-only on mobile.

## 2. Spotify: link + import

- Extend the existing PKCE scopes to include `playlist-read-private`, `playlist-read-collaborative`, and `user-library-read`.
- New server functions to fetch the user's Spotify playlists, playlist tracks, and saved tracks (paginated), called with the user's Spotify token.
- Import writes into the existing `playlists` / `playlist_tracks` / `liked_songs` tables, tagged with their Spotify source ID so re-syncing updates instead of duplicating.
- Import runs on first connect and via a manual "Import now" action, with a progress toast.

## 3. YouTube: link + import + write-back

YouTube Data API requires a Google OAuth client that you own; Lovable has no ready-made YouTube connector. So:

- You create an OAuth client in the Google Cloud console (Web application) with the app's callback URL, requesting scope `https://www.googleapis.com/auth/youtube` (read + write). I'll give you the exact redirect URI and scope list, then ask for the client ID and secret through the secure secret form.
- Server-side OAuth code exchange and refresh; tokens stored per user, encrypted, in a new `user_music_connections` table (provider, encrypted refresh token, expiry, external account name, last synced). Server-only access — nothing touches the browser.
- Import: user's YouTube playlists, their items, and Liked videos → Sonance playlists / liked songs, same de-duplicated mapping as Spotify.
- Write-back: creating or editing a Sonance playlist that originated from YouTube (or one you explicitly push) calls `playlists.insert` / `playlistItems.insert|delete` on the user's account. Push is an explicit "Sync to YouTube" action on the playlist page, not silent background writing.

## 4. Housekeeping

- Disconnect clears stored tokens (and revokes with the provider), leaves imported content in place.
- Failures surface as readable toasts (expired token → prompt to reconnect; YouTube quota → retry later).
- Imported tracks keep working with the existing playback resolver, so they play through whichever source resolves.

## Technical notes

- New table `user_music_connections` (user_id, provider, encrypted tokens, scopes, external_account_label, last_synced_at) with RLS scoped to `auth.uid()` and service-role grants; tokens only readable by server functions.
- `playlists` / `playlist_tracks` gain `source_provider` and `source_external_id` columns for idempotent re-sync and write-back mapping.
- All provider calls go through `createServerFn` handlers — no provider tokens in the browser.
- Spotify's browser PKCE session stays as-is for Premium full-track playback; the new server-side record covers import.

## What I need from you

The Google OAuth client ID and secret (I'll walk you through creating it). Spotify needs nothing new — existing app credentials cover the extra scopes.
