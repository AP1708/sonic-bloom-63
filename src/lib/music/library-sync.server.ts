import { markSynced } from "./connections.server";
import {
  fetchSpotifyPlaylists,
  fetchSpotifyPlaylistTracks,
  fetchSpotifySavedTracks,
  spotifyUserToken,
} from "./spotify-account.server";
import {
  addVideoToYouTubePlaylist,
  createYouTubePlaylist,
  fetchYouTubeLikedVideos,
  fetchYouTubePlaylistItems,
  fetchYouTubePlaylists,
  youtubeAccessToken,
} from "./youtube-account.server";

/** Server-only import/export of a listener's provider library into Sonance. */

export interface ImportSummary {
  playlists: number;
  tracks: number;
  liked: number;
}

interface IncomingTrack {
  trackId: string;
  source: "spotify" | "youtube";
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationSec: number;
  externalId: string;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function upsertPlaylist(
  userId: string,
  provider: "spotify" | "youtube",
  external: { id: string; title: string; description: string | null; artworkUrl: string | null },
): Promise<string> {
  const db = await admin();
  const { data: existing } = await db
    .from("playlists")
    .select("id")
    .eq("owner_id", userId)
    .eq("source_provider", provider)
    .eq("source_external_id", external.id)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from("playlists")
      .update({
        title: external.title,
        description: external.description,
        cover_url: external.artworkUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await db
    .from("playlists")
    .insert({
      owner_id: userId,
      title: external.title,
      description: external.description,
      cover_url: external.artworkUrl,
      source_provider: provider,
      source_external_id: external.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function replacePlaylistTracks(
  userId: string,
  playlistId: string,
  provider: "spotify" | "youtube",
  tracks: IncomingTrack[],
) {
  const db = await admin();
  await db.from("playlist_tracks").delete().eq("playlist_id", playlistId);
  if (!tracks.length) return 0;
  const rows = tracks.map((track, index) => ({
    playlist_id: playlistId,
    track_id: track.trackId,
    source: track.source,
    title: track.title,
    artist: track.artist,
    artwork_url: track.artworkUrl,
    duration_sec: track.durationSec,
    position: index,
    added_by: userId,
    source_provider: provider,
    source_external_id: track.externalId,
  }));
  const { error } = await db.from("playlist_tracks").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

async function upsertLiked(userId: string, tracks: IncomingTrack[]) {
  if (!tracks.length) return 0;
  const db = await admin();
  const rows = tracks.map((track) => ({
    user_id: userId,
    track_id: track.trackId,
    source: track.source,
    title: track.title,
    artist: track.artist,
    artwork_url: track.artworkUrl,
    duration_sec: track.durationSec,
  }));
  const { error } = await db
    .from("liked_songs")
    .upsert(rows, { onConflict: "user_id,track_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function importSpotifyLibrary(userId: string): Promise<ImportSummary> {
  const token = await spotifyUserToken(userId);
  const playlists = await fetchSpotifyPlaylists(token);
  let trackCount = 0;

  for (const playlist of playlists) {
    const tracks = await fetchSpotifyPlaylistTracks(token, playlist.id);
    const playlistId = await upsertPlaylist(userId, "spotify", playlist);
    trackCount += await replacePlaylistTracks(
      userId,
      playlistId,
      "spotify",
      tracks.map((t) => ({ ...t, source: "spotify" as const })),
    );
  }

  const saved = await fetchSpotifySavedTracks(token);
  const liked = await upsertLiked(
    userId,
    saved.map((t) => ({ ...t, source: "spotify" as const })),
  );

  await markSynced(userId, "spotify");
  return { playlists: playlists.length, tracks: trackCount, liked };
}

export async function importYouTubeLibrary(userId: string): Promise<ImportSummary> {
  const token = await youtubeAccessToken(userId);
  const playlists = await fetchYouTubePlaylists(token);
  let trackCount = 0;

  for (const playlist of playlists) {
    const items = await fetchYouTubePlaylistItems(token, playlist.id);
    const playlistId = await upsertPlaylist(userId, "youtube", playlist);
    trackCount += await replacePlaylistTracks(
      userId,
      playlistId,
      "youtube",
      items.map((item) => ({
        trackId: `yt-${item.videoId}`,
        source: "youtube" as const,
        title: item.title,
        artist: item.artist,
        artworkUrl: item.artworkUrl,
        durationSec: 0,
        externalId: item.videoId,
      })),
    );
  }

  const likedVideos = await fetchYouTubeLikedVideos(token);
  const liked = await upsertLiked(
    userId,
    likedVideos.map((item) => ({
      trackId: `yt-${item.videoId}`,
      source: "youtube" as const,
      title: item.title,
      artist: item.artist,
      artworkUrl: item.artworkUrl,
      durationSec: 0,
      externalId: item.videoId,
    })),
  );

  await markSynced(userId, "youtube");
  return { playlists: playlists.length, tracks: trackCount, liked };
}

/** Pushes a Sonance playlist to the listener's YouTube account. */
export async function pushPlaylistToYouTube(
  userId: string,
  playlistId: string,
): Promise<{ added: number; skipped: number; youtubePlaylistId: string }> {
  const token = await youtubeAccessToken(userId);
  const db = await admin();

  const { data: playlist, error } = await db
    .from("playlists")
    .select("id, title, description, owner_id, source_provider, source_external_id")
    .eq("id", playlistId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!playlist || playlist.owner_id !== userId) throw new Error("Playlist not found.");

  let ytPlaylistId =
    playlist.source_provider === "youtube" ? playlist.source_external_id : null;
  if (!ytPlaylistId) {
    ytPlaylistId = await createYouTubePlaylist(token, playlist.title, playlist.description);
    await db
      .from("playlists")
      .update({ source_provider: "youtube", source_external_id: ytPlaylistId })
      .eq("id", playlist.id);
  }

  const existing = new Set(
    (await fetchYouTubePlaylistItems(token, ytPlaylistId)).map((item) => item.videoId),
  );

  const { data: tracks } = await db
    .from("playlist_tracks")
    .select("track_id, source, source_external_id")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  let added = 0;
  let skipped = 0;
  for (const track of tracks ?? []) {
    const videoId =
      track.source === "youtube"
        ? (track.source_external_id ?? track.track_id.replace(/^yt-/, ""))
        : null;
    if (!videoId || existing.has(videoId)) {
      skipped += 1;
      continue;
    }
    try {
      await addVideoToYouTubePlaylist(token, ytPlaylistId, videoId);
      existing.add(videoId);
      added += 1;
    } catch (err) {
      console.error("Failed to add video to YouTube playlist", err);
      skipped += 1;
    }
  }

  return { added, skipped, youtubePlaylistId: ytPlaylistId };
}
