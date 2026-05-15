"use server";

import { clearVerifiedKey, hasVerifiedKey, verifyAndStoreKey } from "@/lib/data/auth";
import { verifyKeyInputSchema } from "@/lib/schemas";

/**
 * Server Actions — the "use server" boundary callable from Client
 * Components. Each action validates client input via zod, delegates to
 * the `lib/data/auth` Data Access Layer, and returns a UI-facing DTO.
 *
 * VerifyKeyResult is intentionally defined here (not re-exported from
 * the DAL) — "use server" files require strict export shapes; defining
 * the type locally keeps the file boundary clean.
 */

export interface VerifyKeyResult {
  ok: boolean;
  message: string;
}

export async function verifyOpenAiKeyAction(rawKey: string): Promise<VerifyKeyResult> {
  const parsed = verifyKeyInputSchema.safeParse(rawKey);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid key format. OpenAI keys usually start with 'sk-' and are longer.",
    };
  }
  return verifyAndStoreKey(parsed.data);
}

/**
 * Server-side "is the user verified" check. Used by client components
 * that need to re-confirm session validity (e.g., after a long idle).
 */
export async function hasVerifiedKeyAction(): Promise<boolean> {
  return hasVerifiedKey();
}

/**
 * Powers the Disconnect button in `ConnectionStatusCard`.
 */
export async function clearVerifiedKeyAction(): Promise<void> {
  return clearVerifiedKey();
}
