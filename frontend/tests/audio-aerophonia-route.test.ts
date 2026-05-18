import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/audio/aerophonia route handler contract.
 *
 * The route streams the Pond5 *Aerophonia* track via:
 *   1. Vercel Blob (production) when `BLOB_AUDIO_AEROPHONIA_URL` is set
 *      AND the host is on the allowlist (`*.public.blob.vercel-storage.com`)
 *   2. Local disk fallback (`private/audio/aerophonia-full.mp3`) otherwise
 *
 * Tests cover the security-critical SSRF allowlist, the Range-request
 * forwarding for iOS Safari, and the fail-closed behavior on upstream
 * errors. `node:fs` + `node:fs/promises` are mocked so the local-
 * fallback path can be exercised deterministically without depending
 * on a test fixture file on disk.
 *
 * Pattern: each test resets the module cache + stubs `BLOB_AUDIO_AEROPHONIA_URL`
 * + dynamically imports the route handler so the env captured at
 * module load reflects this test's intent (mirrors `tests/env.test.ts`).
 */

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  createReadStream: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ stat: mocks.stat }));
vi.mock("node:fs", () => ({ createReadStream: mocks.createReadStream }));

function makeRequest(opts: { range?: string } = {}): Request {
  const headers = new Headers();
  if (opts.range !== undefined) {
    headers.set("range", opts.range);
  }
  return new Request("http://localhost/api/audio/aerophonia", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  mocks.stat.mockReset();
  mocks.createReadStream.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("/api/audio/aerophonia — SSRF allowlist", () => {
  it("does NOT fetch a BLOB_AUDIO_AEROPHONIA_URL whose host is outside the allowlist", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", "https://evil.example.com/track.mp3");
    mocks.stat.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(fetch).not.toHaveBeenCalled();
    // Falls through to serveLocal → file missing → 404 (proves the
    // disallowed URL was never touched).
    expect(response.status).toBe(404);
  });
});

describe("/api/audio/aerophonia — local fallback", () => {
  it("returns 404 when no env var is set AND the local file does not exist", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", undefined);
    mocks.stat.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 200 with Content-Length + audio/mpeg + Accept-Ranges when the local file exists and no Range header is sent", async () => {
    const { Readable } = await import("node:stream");
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", undefined);
    mocks.stat.mockResolvedValue({ size: 12345 });
    mocks.createReadStream.mockReturnValue(Readable.from(Buffer.from("fake-audio")));

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Content-Length")).toBe("12345");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 206 + Content-Range + recalculated Content-Length when Range header is present", async () => {
    const { Readable } = await import("node:stream");
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", undefined);
    mocks.stat.mockResolvedValue({ size: 1000 });
    mocks.createReadStream.mockReturnValue(Readable.from(Buffer.from("partial")));

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest({ range: "bytes=0-99" }));

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-99/1000");
    expect(response.headers.get("Content-Length")).toBe("100"); // 99 - 0 + 1
  });

  it("returns 416 when the Range header asks for bytes beyond the file size", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", undefined);
    mocks.stat.mockResolvedValue({ size: 500 });

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest({ range: "bytes=900-999" }));

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */500");
  });
});

describe("/api/audio/aerophonia — Vercel Blob proxy", () => {
  const VALID_BLOB_URL =
    "https://gtrphvv80fvvov7m.public.blob.vercel-storage.com/aerophonia-full.mp3";

  it("proxies a 200 from a valid Vercel Blob URL with audio/mpeg Content-Type", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", VALID_BLOB_URL);
    vi.mocked(fetch).mockResolvedValue(
      new Response("blob-bytes", {
        status: 200,
        headers: { "content-length": "12345" },
      })
    );

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Content-Length")).toBe("12345");
    expect(fetch).toHaveBeenCalledWith(VALID_BLOB_URL, expect.any(Object));
  });

  it("forwards the client's Range header to the upstream blob", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", VALID_BLOB_URL);
    vi.mocked(fetch).mockResolvedValue(
      new Response("partial-bytes", {
        status: 206,
        headers: {
          "content-range": "bytes 0-99/12345",
          "content-length": "100",
        },
      })
    );

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest({ range: "bytes=0-99" }));

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall).toBeDefined();
    const requestInit = fetchCall?.[1] as RequestInit | undefined;
    expect(requestInit).toBeDefined();
    const upstreamHeaders = requestInit?.headers as Headers;
    expect(upstreamHeaders.get("range")).toBe("bytes=0-99");

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-99/12345");
    expect(response.headers.get("Content-Length")).toBe("100");
  });

  it("preserves 416 from upstream (Range-not-satisfiable is not a fault)", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", VALID_BLOB_URL);
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 416,
        headers: { "content-range": "bytes */12345" },
      })
    );

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest({ range: "bytes=99999-" }));

    expect(response.status).toBe(416);
  });

  it("returns 502 when upstream returns a non-2xx, non-206, non-416 status", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", VALID_BLOB_URL);
    vi.mocked(fetch).mockResolvedValue(new Response("upstream error", { status: 500 }));

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
  });

  it("returns 502 when fetch itself rejects (network failure)", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", VALID_BLOB_URL);
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
  });

  it("does NOT leak upstream body on error (502 has no body)", async () => {
    vi.resetModules();
    vi.stubEnv("BLOB_AUDIO_AEROPHONIA_URL", VALID_BLOB_URL);
    vi.mocked(fetch).mockResolvedValue(
      new Response("sensitive upstream error: SECRET", { status: 500 })
    );

    const { GET } = await import("@/app/api/audio/aerophonia/route");
    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain("SECRET");
  });
});
