import { createFileRoute } from "@tanstack/react-router";
import { ANDROID_RELEASE_REPO } from "@/lib/apk/release";

/**
 * Same-origin streaming proxy for the signed IMUSIC APK.
 *
 * GitHub release assets redirect to a storage host whose CORS headers are not
 * dependable for cross-origin *range* reads, which is exactly what resumable
 * downloading needs. This route forwards `Range` upstream and passes the
 * upstream 206/200 back untouched.
 *
 * It is NOT an open proxy: only release assets from the IMUSIC repo are
 * accepted, and only GET/HEAD.
 */

const ALLOWED_PREFIXES = [
  `https://github.com/${ANDROID_RELEASE_REPO}/releases/download/`,
  "https://objects.githubusercontent.com/",
  "https://release-assets.githubusercontent.com/",
];

function isAllowed(raw: string | null): raw is string {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return ALLOWED_PREFIXES.some((prefix) => url.href.startsWith(prefix));
}

const PASSTHROUGH = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

async function proxy(request: Request, method: "GET" | "HEAD") {
  const target = new URL(request.url).searchParams.get("url");
  if (!isAllowed(target)) {
    return new Response("Forbidden target", { status: 403 });
  }

  const forwarded = new Headers({ "User-Agent": "imusic-apk-proxy" });
  const range = request.headers.get("range");
  if (range) forwarded.set("Range", range);
  const ifRange = request.headers.get("if-range");
  if (ifRange) forwarded.set("If-Range", ifRange);

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers: forwarded, redirect: "follow" });
  } catch (error) {
    console.error("APK proxy upstream failure", error);
    return new Response("Upstream unavailable", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream error", { status: upstream.status });
  }

  const headers = new Headers();
  for (const name of PASSTHROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Expose-Headers",
    "content-length, content-range, accept-ranges, etag, last-modified",
  );

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

export const Route = createFileRoute("/api/public/apk")({
  server: {
    handlers: {
      GET: ({ request }) => proxy(request, "GET"),
      HEAD: ({ request }) => proxy(request, "HEAD"),
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "range, if-range",
          },
        }),
    },
  },
});
