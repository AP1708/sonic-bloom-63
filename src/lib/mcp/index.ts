import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPlaylists from "./tools/list-playlists";
import listPlaylistTracks from "./tools/list-playlist-tracks";
import listLikedSongs from "./tools/list-liked-songs";
import recentListening from "./tools/recent-listening";
import createPlaylist from "./tools/create-playlist";
import addTrackToPlaylist from "./tools/add-track-to-playlist";

// Must be the direct Supabase host: SUPABASE_URL becomes a proxy URL on publish.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "harmony-hub-79",
  title: "Harmony Hub (79)",
  version: "0.1.0",
  instructions:
    "Tools for the IMUSIC library. Read the signed-in user's playlists, playlist tracks, liked songs, and recent listening history, and create playlists or add tracks to them.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listPlaylists,
    listPlaylistTracks,
    listLikedSongs,
    recentListening,
    createPlaylist,
    addTrackToPlaylist,
  ],
});
