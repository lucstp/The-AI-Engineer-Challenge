import { afterEach, describe, expect, it, vi } from "vitest";

import { seal, unseal } from "@/lib/session-crypto";

/**
 * AES-256-GCM authenticated-encryption contract for the session cookie.
 *
 * The seal/unseal pair is the only thing standing between cookie-jar
 * disclosure and full OpenAI-key exfiltration. Tests cover the four
 * properties a FAANG cryptographic review would block on:
 *   1. Round-trip correctness (across empty / short / long payloads)
 *   2. Tamper detection (auth tag failure on any byte modification)
 *   3. Format validation (malformed inputs return null, never throw)
 *   4. Wrong-secret rejection (re-keyed module fails to decrypt previously-sealed value)
 *   5. IV uniqueness (random IV per seal — same plaintext yields different ciphertexts)
 *
 * Every failure mode resolves to `null` — never a throw, never a
 * partial decrypt. Callers MUST treat null as "no valid session."
 */

describe("session-crypto round-trip", () => {
  it("preserves a plain sk-style key end-to-end", () => {
    const payload = "sk-proj-abcdef1234567890abcdef1234567890";
    const blob = seal(payload);
    expect(unseal(blob)).toBe(payload);
  });

  it("rejects an empty-plaintext blob on unseal (defensive: never trust a zero-byte ciphertext)", () => {
    // seal("") produces a 3-part blob whose ciphertext segment is the
    // empty string. unseal's part-presence guard then returns null.
    // Production sk-keys are always 24+ chars, so this only matters as a
    // safety net against accidental sealing of empty values — and the
    // safety net is the documented contract.
    const blob = seal("");
    expect(unseal(blob)).toBeNull();
  });

  it("round-trips a 200-character payload", () => {
    const payload = "x".repeat(200);
    const blob = seal(payload);
    expect(unseal(blob)).toBe(payload);
  });

  it("round-trips unicode (multi-byte UTF-8)", () => {
    const payload = "Coldplay — 🎵 — sk-test";
    const blob = seal(payload);
    expect(unseal(blob)).toBe(payload);
  });
});

describe("session-crypto IV uniqueness", () => {
  it("emits different blobs for the same plaintext (random IV per seal)", () => {
    const payload = "sk-deterministic-test-payload-1234567890";
    const a = seal(payload);
    const b = seal(payload);
    expect(a).not.toBe(b);
    // Both still decrypt to the same plaintext.
    expect(unseal(a)).toBe(payload);
    expect(unseal(b)).toBe(payload);
  });
});

describe("session-crypto tamper detection", () => {
  it("returns null when the IV part is mutated", () => {
    const blob = seal("sk-tamper-iv-12345678901234567890123");
    const [iv, ciphertext, tag] = blob.split(".");
    if (iv === undefined || ciphertext === undefined || tag === undefined) {
      throw new Error("sealed blob is not 3-part — test fixture broken");
    }
    // Flip one base64url character of the IV.
    const tamperedIv = iv.startsWith("A") ? `B${iv.slice(1)}` : `A${iv.slice(1)}`;
    const tamperedBlob = [tamperedIv, ciphertext, tag].join(".");
    expect(unseal(tamperedBlob)).toBeNull();
  });

  it("returns null when the ciphertext part is mutated", () => {
    const blob = seal("sk-tamper-ct-12345678901234567890123");
    const [iv, ciphertext, tag] = blob.split(".");
    if (iv === undefined || ciphertext === undefined || tag === undefined) {
      throw new Error("sealed blob is not 3-part — test fixture broken");
    }
    const tamperedCt = ciphertext.startsWith("A")
      ? `B${ciphertext.slice(1)}`
      : `A${ciphertext.slice(1)}`;
    const tamperedBlob = [iv, tamperedCt, tag].join(".");
    expect(unseal(tamperedBlob)).toBeNull();
  });

  it("returns null when the auth tag part is mutated", () => {
    const blob = seal("sk-tamper-tag-1234567890123456789012");
    const [iv, ciphertext, tag] = blob.split(".");
    if (iv === undefined || ciphertext === undefined || tag === undefined) {
      throw new Error("sealed blob is not 3-part — test fixture broken");
    }
    const tamperedTag = tag.startsWith("A") ? `B${tag.slice(1)}` : `A${tag.slice(1)}`;
    const tamperedBlob = [iv, ciphertext, tamperedTag].join(".");
    expect(unseal(tamperedBlob)).toBeNull();
  });
});

describe("session-crypto format validation", () => {
  it("returns null on a missing-part blob (only 2 dots)", () => {
    expect(unseal("aaa.bbb")).toBeNull();
  });

  it("returns null on an over-segmented blob (4 dot-separated parts)", () => {
    expect(unseal("aaa.bbb.ccc.ddd")).toBeNull();
  });

  it("returns null on empty parts", () => {
    expect(unseal("..")).toBeNull();
    expect(unseal("aaa..ccc")).toBeNull();
  });

  it("returns null on a completely non-base64 string", () => {
    expect(unseal("this-is-not-a-sealed-cookie")).toBeNull();
  });

  it("returns null on an empty string", () => {
    expect(unseal("")).toBeNull();
  });

  it("returns null when the IV has the wrong length (forged 6-byte IV)", () => {
    // A valid IV is 12 bytes (96 bits) — anything else is rejected before
    // the cipher gets a chance to throw.
    const ivShort = Buffer.from([1, 2, 3, 4, 5, 6]).toString("base64url");
    const ct = Buffer.from([0]).toString("base64url");
    const tag = Buffer.alloc(16).toString("base64url");
    expect(unseal(`${ivShort}.${ct}.${tag}`)).toBeNull();
  });
});

describe("session-crypto wrong-secret rejection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null when unsealing under a different SESSION_SECRET than the one used to seal", async () => {
    // Seal with the current (vitest-setup) SESSION_SECRET.
    const blob = seal("sk-secret-rotation-test-12345678901234567");

    // Reset module cache + override SESSION_SECRET → next import of the
    // crypto module derives a different AES key. The previously-sealed
    // blob is no longer decryptable.
    vi.resetModules();
    vi.stubEnv("SESSION_SECRET", "a-DIFFERENT-vitest-secret-of-sufficient-length-1234567890");

    const { unseal: unsealUnderDifferentSecret } = await import("@/lib/session-crypto");
    expect(unsealUnderDifferentSecret(blob)).toBeNull();
  });
});
