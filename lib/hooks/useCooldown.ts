// lib/hooks/useCooldown.ts
import { useCallback, useEffect, useState } from 'react';

/** A countdown for buttons that must wait between uses ("Resend code in
 * 42s"). Ticks once a second and clears itself at zero. */
export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState<number | null>(initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : null);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (until == null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [until]);

  const start = useCallback((seconds: number) => setUntil(Date.now() + seconds * 1000), []);

  return { secondsLeft, start };
}
