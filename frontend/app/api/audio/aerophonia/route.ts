import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { serverEnv } from "@/lib/env";

/**
 * Streams the full licensed Pond5 "Aerophonia" track via either:
 *
 *   1. Vercel Blob (production path) — when `BLOB_AUDIO_AEROPHONIA_URL`
 *      env var is set. The route proxy-streams from the CDN, forwarding
 *      Range requests. The asset NEVER ships in the function bundle or
 *      git repo. The URL has a random Vercel hash that gives obscurity
 *      on top of route opacity. Host-allowlisted to defeat SSRF if the
 *      env var were ever tampered with.
 *
 *   2. Local disk (dev fallback) — when no Blob URL is set, reads
 *      `private/audio/aerophonia-full.mp3` from process.cwd(). For
 *      local development with the file on disk.
 *
 * Threat model (honestly stated): not DRM. Anything playable in a
 * browser is technically capturable. We are only preventing
 *   - public GitHub clone yielding the MP3 (Blob path → file not in
 *     repo at all)
 *   - direct-URL guessing (route is opaque; signed Blob URL is opaque
 *     and ephemeral)
 *   - search-engine indexing (X-Robots-Tag)
 *
 * Range-request support is required for iOS Safari's `<audio>` element.
 * In Blob mode, Range is forwarded upstream. In local mode, we slice
 * the file ourselves.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_AUDIO_PATH = path.join(process.cwd(), "private/audio/aerophonia-full.mp3");
const MIME_TYPE = "audio/mpeg";
const CACHE_CONTROL = "private, max-age=31536000, immutable";
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export async function GET(request: Request): Promise<Response> {
  // ── Prefer Vercel Blob in production ─────────────────────────────────
  const blobUrl = serverEnv.BLOB_AUDIO_AEROPHONIA_URL;
  if (blobUrl !== undefined && isAllowedBlobHost(blobUrl)) {
    return proxyFromBlob(request, blobUrl);
  }
  // ── Local-disk fallback (dev) ────────────────────────────────────────
  return serveLocal(request);
}

// ──────────────────────────────────────────────────────────────────────
// Blob-CDN proxy
// ──────────────────────────────────────────────────────────────────────

async function proxyFromBlob(request: Request, blobUrl: string): Promise<Response> {
  const rangeHeader = request.headers.get("range");
  const upstreamHeaders = new Headers();
  if (rangeHeader !== null) upstreamHeaders.set("range", rangeHeader);

  let upstream: Response;
  try {
    upstream = await fetch(blobUrl, { headers: upstreamHeaders, cache: "no-store" });
  } catch {
    return new Response("Upstream audio fetch failed.", { status: 502 });
  }

  // Treat any non-success non-partial-content response as upstream
  // error. Don't leak upstream body / status text to the client.
  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
    return new Response(null, { status: 502 });
  }

  const responseHeaders = buildResponseHeaders();
  // Forward bytes-meaning headers from upstream so the browser's audio
  // element gets the right Content-Range / Content-Length.
  const contentLength = upstream.headers.get("content-length");
  if (contentLength !== null) responseHeaders.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange !== null) responseHeaders.set("Content-Range", contentRange);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

function isAllowedBlobHost(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Local-disk fallback
// ──────────────────────────────────────────────────────────────────────

async function serveLocal(request: Request): Promise<Response> {
  let fileSize: number;
  try {
    fileSize = (await stat(LOCAL_AUDIO_PATH)).size;
  } catch {
    return new Response("Audio asset not found.", { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader === null) {
    const headers = buildResponseHeaders();
    headers.set("Content-Length", String(fileSize));
    return new Response(toWebStream(createReadStream(LOCAL_AUDIO_PATH)), {
      status: 200,
      headers,
    });
  }

  const parsed = parseRange(rangeHeader, fileSize);
  if (parsed === null) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }
  const { start, end } = parsed;
  const chunkSize = end - start + 1;
  const headers = buildResponseHeaders();
  headers.set("Content-Length", String(chunkSize));
  headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);

  return new Response(toWebStream(createReadStream(LOCAL_AUDIO_PATH, { start, end })), {
    status: 206,
    headers,
  });
}

function parseRange(header: string, fileSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (match === null) return null;
  const start = Number(match[1]);
  const end = match[2] && match[2].length > 0 ? Number(match[2]) : fileSize - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize ||
    end >= fileSize
  ) {
    return null;
  }
  return { start, end };
}

function toWebStream(nodeStream: ReturnType<typeof createReadStream>): ReadableStream<Uint8Array> {
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

// ──────────────────────────────────────────────────────────────────────
// Shared response headers (Blob + local)
// ──────────────────────────────────────────────────────────────────────

function buildResponseHeaders(): Headers {
  return new Headers({
    "Content-Type": MIME_TYPE,
    "Accept-Ranges": "bytes",
    "Cache-Control": CACHE_CONTROL,
    "Content-Disposition": 'inline; filename="aerophonia.mp3"',
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
  });
}
