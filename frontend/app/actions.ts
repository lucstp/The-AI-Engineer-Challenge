"use server";

import { clearVerifiedKey, hasVerifiedKey } from "@/lib/data/auth";

/**
 * Server Actions — the "use server" boundary callable from Client
 * Components. Each action delegates to the `lib/data/auth` Data Access
 * Layer.
 *
 * The verify path used to live here as `verifyOpenAiKeyAction(rawKey)`.
 * It was migrated to a route handler at `POST /api/verify-key` because
 * Next.js logs Server Action arguments to the dev-mode (`pnpm dev`)
 * terminal — a developer-class leak for the raw sk-... key. The `has`
 * and `clear` actions stay here: they take no arguments, so no payload
 * is ever logged.
 */

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
