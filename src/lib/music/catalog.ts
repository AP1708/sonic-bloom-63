import type { Collection, LyricLine, Shelf, Track } from "./types";

/**
 * Catalog of public-domain Indian recordings (pre-1965 Indian sound recordings,
 * hosted by the Internet Archive). Every entry carries a direct `audioUrl`, so
 * the built-in engine can actually play it — no external key required. Spotify
 * and YouTube providers layer on top of this once their credentials are wired in.
 */

const ARCHIVE = "https://archive.org/download";

function a(
  id: string,
  title: string,
  artist: string,
  album: string,
  durationSec: number,
  path: string,
): Track {
  return {
    id,
    title,
    artist,
    album,
    durationSec,
    source: "archive",
    artworkUrl: null,
    audioUrl: `${ARCHIVE}/${path}`,
    externalUrl: `https://archive.org/details/${path.split("/")[0]}`,
  };
}

const I94 = "www.VintageSense.com-Vintage-Indian-Music-94n";
const I39 = "www.VintageSense.com-Vintage-Indian-Music-39n";
const I74 = "www.VintageSense.com-Vintage-Indian-Music-74n";
const I31 = "www.VintageSense.com-Vintage-Indian-Music-31_179";

export const DEMO_TRACKS: Track[] = [
  // Yahudi (1958) — Shankar–Jaikishan
  a("in-18615", "Title Music (Yahudi)", "Shankar–Jaikishan", "Yahudi (1958)", 143, `${I94}/18615_indian_music_VintageSense.com_Yahudi_00_1958_Shankar_Jaikishan_Title_music_Shankar_Jaikishan_VintageSense.com_song_id_18615.mp3`),
  a("in-18616", "Yeh Duniya Haaye Hamari", "Mohammed Rafi", "Yahudi (1958)", 205, `${I94}/18616_indian_music_VintageSense.com_Yahudi_01_1958_Rafi_Yeh_duniya_haaye_hamari_yeh_duniya_Shankar_Jaikishan_VintageSense.com_song_id_18616.mp3`),
  a("in-18617", "Bechain Dil Khoyi Si Nazar", "Lata Mangeshkar & Geeta Dutt", "Yahudi (1958)", 236, `${I94}/18617_indian_music_VintageSense.com_Yahudi_02_1958_Lata__Geeta_Dutt_Bechain_dil_khoyi_si_nazar_Shankar_Jaikishan_VintageSense.com_song_id_18617.mp3`),
  a("in-18619", "Dil Se Tujhko Yeh Mera Diwanapan", "Mukesh", "Yahudi (1958)", 244, `${I94}/18619_indian_music_VintageSense.com_Yahudi_04_1958_Mukesh_Dil_se_tujh_ko_yeh_mera_diwana_pan_hai_Shankar_Jaikishan_VintageSense.com_song_id_18619.mp3`),
  a("in-18620", "Aansoo Ki Aag Leke", "Lata Mangeshkar", "Yahudi (1958)", 180, `${I94}/18620_indian_music_VintageSense.com_Yahudi_05_1958_Lata_Aansoo_ki_aag_leke_teri_yaad_aayi_Shankar_Jaikishan_VintageSense.com_song_id_18620.mp3`),
  a("in-18621", "Aate Jaate Pehlu Mein", "Lata Mangeshkar", "Yahudi (1958)", 196, `${I94}/18621_indian_music_VintageSense.com_Yahudi_06_1958_Lata_Aatey_jaatey_pehlu_mei-n_aaya_koyi_Shankar_Jaikishan_VintageSense.com_song_id_18621.mp3`),
  a("in-18622", "Dil Mein Pyar Ka Toofan", "Lata Mangeshkar", "Yahudi (1958)", 211, `${I94}/18622_indian_music_VintageSense.com_Yahudi_07_1958_Lata_Dil_mei-n_pyar_ka_toofaan_na_samjhe_Shankar_Jaikishan_VintageSense.com_song_id_18622.mp3`),
  a("in-18623", "Musical Interludes (Yahudi)", "Shankar–Jaikishan", "Yahudi (1958)", 335, `${I94}/18623_indian_music_VintageSense.com_Yahudi_51_1958_Shankar_Jaikishan_Musical_interludes_Shankar_Jaikishan_VintageSense.com_song_id_18623.mp3`),

  // Pocketmaar (1956) — Madan Mohan
  a("in-07642", "Balma Anari Manga De Ghoda Gadi", "Lata Mangeshkar", "Pocketmaar (1956)", 201, `${I39}/07642_indian_music_VintageSense.com_1956_Pocketmaar_1956_Lata_Balma_anari_manga_de_ghora_gari_Madan_Mohan_VintageSense.com_song_id_07642.mp3`),
  a("in-07643", "Chhoti Si Hai Zindagi", "Lata Mangeshkar", "Pocketmaar (1956)", 177, `${I39}/07643_indian_music_VintageSense.com_1956_Pocketmaar_1956_Lata_Chhoti_si_hai_zindagi_apni_khushi_se_jee_Madan_Mohan_VintageSense.com_song_id_07643.mp3`),
  a("in-07645", "Pyase Nainon Ki Pyas Bujha Le", "Lata Mangeshkar", "Pocketmaar (1956)", 242, `${I39}/07645_indian_music_VintageSense.com_1956_Pocketmaar_1956_Lata_Pyase_nainon_ki_pyas_bujha_le_Madan_Mohan_VintageSense.com_song_id_07645.mp3`),
  a("in-07646", "Ladi Aankh Se Aankh", "Lata Mangeshkar & Mohammed Rafi", "Pocketmaar (1956)", 214, `${I39}/07646_indian_music_VintageSense.com_1956_Pocketmaar_1956_Lata_Rafi_Ladi_aankh_se_aankh_mohabbat_ho_gayi_Madan_Mohan_VintageSense.com_song_id_07646.mp3`),
  a("in-07647", "Yeh Nayi Nayi Preet Hai", "Lata Mangeshkar & Talat Mahmood", "Pocketmaar (1956)", 188, `${I39}/07647_indian_music_VintageSense.com_1956_Pocketmaar_1956_Lata_Talat_Yeh_nayi_nayi_preet_hai_Madan_Mohan_VintageSense.com_song_id_07647.mp3`),
  a("in-07648", "Teri Gali Kaise Aayoon Sajna", "Lata Mangeshkar", "Pocketmaar (1956)", 169, `${I39}/07648_indian_music_VintageSense.com_1956_Pocketmaar_1956_Lata_Teri_gali_kaise_aayoon_sajna_Madan_Mohan_VintageSense.com_song_id_07648.mp3`),
  a("in-07641", "Duniya Ke Saath Chal Pyare", "Geeta Dutt", "Pocketmaar (1956)", 155, `${I39}/07641_indian_music_VintageSense.com_1956_Pocketmaar_1956_Geeta_Dutt_chorus_Duniya_ke_saath_chal_pyare_Madan_Mohan_VintageSense.com_song_id_07641.mp3`),

  // New Delhi (1956) — Shankar–Jaikishan
  a("in-07603", "Milte Hi Nazar", "Kishore Kumar", "New Delhi (1956)", 279, `${I39}/07603_indian_music_vintagesense.com_1956_newDelhi1956_319_03MilteHiNazar_kishore_vintagesense.com_song_id_07603.mp3`),
  a("in-07605", "Are Bhai Nikal Ke Aa Ghar Se", "Kishore Kumar", "New Delhi (1956)", 280, `${I39}/07605_indian_music_vintagesense.com_1956_newDelhi1956_519_05AreBhaiNikalKeAaGharSe_kishore_vintagesense.com_song_id_07605.mp3`),
  a("in-07609", "Koi Mere Sapnon Mein Aaya", "Lata Mangeshkar", "New Delhi (1956)", 245, `${I39}/07609_indian_music_vintagesense.com_1956_newDelhi1956_919_09KoiMereSapnonMeinAaya_lata_vintagesense.com_song_id_07609.mp3`),

  // Badi Behan (1949) — Husnlal–Bhagatram
  a("in-14728", "Title Music (Badi Behan)", "Husnlal–Bhagatram", "Badi Behan (1949)", 90, `${I74}/14728_indian_music_VintageSense.com_Badi_Behan_00_1949_Husnlal_Bhagatram_Title_music_VintageSense.com_song_id_14728.mp3`),
  a("in-14735", "Mohabbat Ke Dhokhe Mein", "Mohammed Rafi", "Badi Behan (1949)", 187, `${I74}/14735_indian_music_VintageSense.com_Badi_Behan_07_1949_Rafi_Mohabbat_ke_dhokhe_mei-n_koyi_na_aaye_Husnlal_Bhagatram_VintageSense.com_song_id_14735.mp3`),
  a("in-14738", "Musical Interludes (Badi Behan)", "Husnlal–Bhagatram", "Badi Behan (1949)", 203, `${I74}/14738_indian_music_VintageSense.com_Badi_Behan_51_1949_Husnlal_Bhagatram_Musical_interludes_VintageSense.com_song_id_14738.mp3`),

  // Late fifties selection
  a("in-09129", "Yeh Chand Yeh Sitare", "Lata Mangeshkar & Manna Dey", "Jai Singh (1959)", 236, `${I31}/09129_indian_music_vintagesense.com_1959_jaiSingh1959_yehChandYehSitarey_lataMannDey_vintagesense.com_song_id_09129.mp3`),
  a("in-09055", "Sitaro Chup Rehna", "Asha Bhosle", "Duniya Na Maane (1959)", 262, `${I31}/09055_indian_music_vintagesense.com_1959_duniyaNaMaane1959_sitaroChupRehna_asha_vintagesense.com_song_id_09055.mp3`),
  a("in-09044", "Title Music (Do Behne)", "Vasant Desai", "Do Behne (1959)", 195, `${I31}/09044_indian_music_VintageSense.com_1959_Do_Behne_1959_Vasant_Desai_Title_music_Musical_interludes_Vasant_Desai_VintageSense.com_song_id_09044.mp3`),
  a("in-09066", "Title Music (Fashionable Wife)", "Suresh Talwar", "Fashionable Wife (1959)", 104, `${I31}/09066_indian_music_VintageSense.com_1959_Fashionable_Wife_1959_Suresh_Talwar_Title_music_Suresh_Talwar_VintageSense.com_song_id_09066.mp3`),
  a("in-09142", "Title Music (Jungle King)", "Bipin–Babul", "Jungle King (1959)", 92, `${I31}/09142_indian_music_VintageSense.com_1959_Jungle_King_1959_Title_music_Bipin_Babul_VintageSense.com_song_id_09142.mp3`),
  a("in-09161", "Title Music (Kal Hamara Hai)", "Chitragupta", "Kal Hamara Hai (1959)", 114, `${I31}/09161_indian_music_VintageSense.com_1959_Kal_Hamara_Hai_1959_Title_music_Musical_interludes_Chitragupta_VintageSense.com_song_id_09161.mp3`),
  a("in-07649", "Title & Ending Music (Pocketmaar)", "Madan Mohan", "Pocketmaar (1956)", 245, `${I39}/07649_indian_music_VintageSense.com_1956_Pocketmaar_1956_Title_music__musical_interlude__ending_music_Madan_Mohan_VintageSense.com_song_id_07649.mp3`),
  a("in-07730", "Musical Interludes (Sati Anusuya)", "Shivram", "Sati Anusuya (1956)", 435, `${I39}/07730_indian_music_vintagesense.com_1956_satiAnusuya1956_1919_19MusicalInterludes_shivram_vintagesense.com_song_id_07730.mp3`),
];

export const TRACKS_BY_ID = new Map(DEMO_TRACKS.map((track) => [track.id, track]));

/** Audio lookup for tracks that come back from the database without a stream URL. */
export function audioUrlFor(trackId: string): string | null {
  return TRACKS_BY_ID.get(trackId)?.audioUrl ?? null;
}

function collection(
  id: string,
  title: string,
  subtitle: string,
  kind: Collection["kind"],
  source: Collection["source"],
  trackIds: string[],
): Collection {
  return { id, title, subtitle, kind, source, trackIds };
}

export const DEMO_COLLECTIONS: Collection[] = [
  collection("c-yahudi", "Yahudi", "Shankar–Jaikishan · 1958", "album", "archive", [
    "in-18615",
    "in-18616",
    "in-18617",
    "in-18619",
    "in-18620",
    "in-18621",
    "in-18622",
  ]),
  collection("c-pocketmaar", "Pocketmaar", "Madan Mohan · 1956", "album", "archive", [
    "in-07642",
    "in-07643",
    "in-07645",
    "in-07646",
    "in-07647",
    "in-07648",
    "in-07641",
  ]),
  collection("c-newdelhi", "New Delhi", "Kishore Kumar & Lata · 1956", "album", "archive", [
    "in-07603",
    "in-07605",
    "in-07609",
  ]),
  collection("c-badibehan", "Badi Behan", "Husnlal–Bhagatram · 1949", "album", "archive", [
    "in-14728",
    "in-14735",
    "in-14738",
  ]),
  collection("c-lata", "Lata Mangeshkar essentials", "The golden voice", "mix", "archive", [
    "in-18620",
    "in-18621",
    "in-07643",
    "in-07648",
    "in-07609",
    "in-09129",
  ]),
  collection("c-playback", "Playback legends", "Rafi, Mukesh, Kishore, Geeta, Asha", "mix", "archive", [
    "in-18616",
    "in-18619",
    "in-07603",
    "in-07641",
    "in-09055",
    "in-14735",
  ]),
  collection("c-instrumental", "Filmi instrumentals", "Title music & interludes", "playlist", "archive", [
    "in-18623",
    "in-07649",
    "in-07730",
    "in-14738",
    "in-09044",
    "in-09161",
  ]),
  collection("c-fifties", "Late fifties reel", "1958–1959 selections", "playlist", "archive", [
    "in-09129",
    "in-09055",
    "in-09066",
    "in-09142",
    "in-18617",
  ]),
];

export const COLLECTIONS_BY_ID = new Map(DEMO_COLLECTIONS.map((c) => [c.id, c]));

export function tracksForCollection(collectionId: string): Track[] {
  const found = COLLECTIONS_BY_ID.get(collectionId);
  if (!found) return [];
  return found.trackIds.map((id) => TRACKS_BY_ID.get(id)).filter((x): x is Track => Boolean(x));
}

export const DEMO_SHELVES: Shelf[] = [
  {
    id: "shelf-indian",
    title: "Indian classics",
    caption: "Golden-era playback, streaming in full",
    items: DEMO_COLLECTIONS.slice(0, 4),
  },
  {
    id: "shelf-voices",
    title: "Voices of the golden era",
    caption: "Lata, Rafi, Mukesh, Kishore, Asha",
    items: [DEMO_COLLECTIONS[4], DEMO_COLLECTIONS[5], DEMO_COLLECTIONS[7]],
  },
  {
    id: "shelf-instrumental",
    title: "Instrumental & interludes",
    caption: "Orchestral cues from the film archives",
    items: [DEMO_COLLECTIONS[6], DEMO_COLLECTIONS[3], DEMO_COLLECTIONS[0]],
  },
];

export const DEMO_LYRICS: LyricLine[] = [
  { timeSec: 0, text: "Lyrics for this archive recording aren't available yet" },
  { timeSec: 12, text: "These are public-domain Indian film recordings" },
  { timeSec: 24, text: "Streamed directly from the Internet Archive" },
  { timeSec: 36, text: "Connect Spotify or YouTube for synced lyrics" },
];
