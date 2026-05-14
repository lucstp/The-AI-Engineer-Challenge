import { useEffect, useRef, useState } from "react";

/**
 * Transient "magic moment" flag — toggled true for 900ms whenever the locked
 * state flips in either direction. Drives the `.shell-burst` CSS animation
 * (cyan + violet glow halo flash) so the height transition has a visible
 * signature beyond the box resize.
 *
 * Returns the current flag value to apply on the chat-shell-frame element.
 */
export function useShellBurstFlash(isChatLocked: boolean): boolean {
  const [shellBurst, setShellBurst] = useState(false);
  const previousIsLockedRef = useRef<boolean>(isChatLocked);

  useEffect(() => {
    if (previousIsLockedRef.current === isChatLocked) {
      return;
    }
    previousIsLockedRef.current = isChatLocked;
    setShellBurst(true);
    const id = window.setTimeout(() => setShellBurst(false), 900);
    return () => window.clearTimeout(id);
  }, [isChatLocked]);

  return shellBurst;
}
