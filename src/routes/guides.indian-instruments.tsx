import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://sonic-bloom-63.lovable.app/guides/indian-instruments";
const TITLE = "Indian Instruments: A Guide to Sitar, Tabla & Sarod — IMUSIC";
const DESCRIPTION =
  "A practical guide to Indian classical instruments — how the sitar, tabla, sarod, bansuri and more are built, how they sound, and what to listen for.";

export const Route = createFileRoute("/guides/indian-instruments")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Indian Instruments: A Guide to Sitar, Tabla & Sarod",
          description: DESCRIPTION,
          mainEntityOfPage: URL,
        }),
      },
    ],
  }),
  component: IndianInstrumentsGuide,
});

interface Instrument {
  name: string;
  family: string;
  summary: string;
  listenFor: string;
}

const INSTRUMENTS: Instrument[] = [
  {
    name: "Sitar",
    family: "Plucked string",
    summary:
      "A long-necked lute with movable frets, six or seven playing strings and up to thirteen sympathetic strings that ring untouched beneath them. Popularised worldwide in the 1960s, it remains the signature voice of Hindustani classical music.",
    listenFor:
      "The shimmering halo behind each note — that is the sympathetic strings resonating — and the meend, a bent glide between pitches produced by pulling the string sideways across the fret.",
  },
  {
    name: "Tabla",
    family: "Percussion",
    summary:
      "A pair of hand drums: the smaller wooden dayan tuned to the tonic, and the deeper metal bayan. The black syahi paste at the centre of each head gives the tabla its unmistakable pitched tone.",
    listenFor:
      "Spoken drum syllables (bols) such as dha, dhin and na, organised into cyclical rhythm patterns called tala — most commonly the sixteen-beat teental.",
  },
  {
    name: "Sarod",
    family: "Plucked string",
    summary:
      "Fretless, with a polished steel fingerboard and a skin-covered resonator. Where the sitar shimmers, the sarod is dark, weighty and vocal, played with a coconut-shell plectrum.",
    listenFor:
      "Continuous slides between notes — with no frets, pitch is entirely in the fingertip — and a percussive attack from the plectrum.",
  },
  {
    name: "Bansuri",
    family: "Wind",
    summary:
      "A side-blown bamboo flute with six or seven finger holes and no keys. Associated in Indian tradition with Krishna, it is one of the oldest instruments still in common use.",
    listenFor:
      "Breathy ornamentation and half-holing, where a finger partially covers a hole to reach microtonal pitches between the written notes.",
  },
  {
    name: "Tanpura",
    family: "Drone string",
    summary:
      "Four to six strings plucked in an endless cycle to create the harmonic bed every Indian classical performance sits on. It plays no melody at all.",
    listenFor:
      "A continuous, slowly pulsing drone — the reference tonic that lets a raga's notes register as consonant or tense.",
  },
  {
    name: "Sarangi",
    family: "Bowed string",
    summary:
      "A bowed, fretless instrument stopped with the fingernails rather than fingertips, with around thirty-five sympathetic strings. It is often described as the closest instrument to the human voice.",
    listenFor:
      "Vocal-style phrasing that shadows a singer almost exactly, and a dense resonance from the sympathetic strings.",
  },
  {
    name: "Veena",
    family: "Plucked string",
    summary:
      "The principal instrument of Carnatic (South Indian) music, carved from a single block of jackwood with fixed frets set into wax.",
    listenFor:
      "Gamaka — the oscillating, ornamented approach to each note that defines Carnatic melody.",
  },
  {
    name: "Harmonium",
    family: "Free reed",
    summary:
      "A hand-pumped reed organ adopted from Europe in the nineteenth century and thoroughly naturalised. It accompanies most devotional and light-classical singing today.",
    listenFor:
      "A steady, slightly nasal chordal cushion under the voice, with the bellows pulse audible between phrases.",
  },
];

function IndianInstrumentsGuide() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-3">
        <p className="label-mono">Listening guide</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          A guide to Indian classical instruments
        </h1>
        <p className="text-muted-foreground">
          Indian classical music is built from a drone, a melody and a rhythm cycle — and each of
          those layers has its own instrument. This guide covers the eight you will hear most often,
          how each one is made, and what to listen for. It pairs with the public-domain archive
          recordings you can stream throughout IMUSIC.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">How a performance is layered</h2>
        <p className="text-muted-foreground">
          Almost every recording you hear follows the same architecture. The tanpura holds an
          unchanging drone on the tonic. A melodic instrument — sitar, sarod, bansuri, sarangi or a
          voice — unfolds a raga over it, starting slow and unmetered before the pulse arrives. The
          tabla then enters with a tala, a repeating rhythmic cycle, and the piece accelerates from
          there. Knowing those three roles makes any unfamiliar recording immediately easier to
          follow.
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">The instruments</h2>
        {INSTRUMENTS.map((instrument) => (
          <article key={instrument.name} className="surface-panel flex flex-col gap-2 p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-lg font-semibold">{instrument.name}</h3>
              <span className="label-mono">{instrument.family}</span>
            </div>
            <p className="text-sm text-muted-foreground">{instrument.summary}</p>
            <p className="text-sm">
              <span className="font-medium">Listen for: </span>
              <span className="text-muted-foreground">{instrument.listenFor}</span>
            </p>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Where to start listening</h2>
        <p className="text-muted-foreground">
          Begin with a solo sitar or bansuri recording so the drone and melody stay easy to separate,
          then move to a tabla-accompanied piece and try to count the sixteen-beat teental cycle.
          Sarangi and vocal recordings reward listening last, once the ornamentation makes sense.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/search"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Search recordings
          </Link>
          <Link
            to="/artists"
            className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse artists
          </Link>
        </div>
      </section>
    </div>
  );
}
