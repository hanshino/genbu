"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Two-layer state: `local` for immediate display, `commit` runs `delayMs`
 * after the last change. External prop changes reset `local` right away
 * (so preset switches / URL restores are not swallowed). `flush()` forces
 * the pending commit now; `flush(val)` commits `val` directly (skipping
 * `local`) — useful when the consumer computes a clamped/normalized value
 * it wants to commit before React's async setState lands.
 */
export function useDebouncedCommit<T>(external: T, commit: (next: T) => void, delayMs = 300) {
  const [local, setLocal] = useState(external);

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  const [prevExternal, setPrevExternal] = useState(external);
  if (!Object.is(external, prevExternal)) {
    setPrevExternal(external);
    setLocal(external);
  }

  useEffect(() => {
    if (Object.is(local, external)) return;
    const handle = setTimeout(() => commitRef.current(local), delayMs);
    return () => clearTimeout(handle);
  }, [local, external, delayMs]);

  const flush = useCallback(
    (override?: T) => {
      commitRef.current(override === undefined ? local : override);
    },
    [local],
  );

  return [local, setLocal, flush] as const;
}
