import { useEffect, useState } from "react";

/** Whole seconds remaining until `expiresAt` (ISO string), never below zero. Display only. */
export function useCountdown(expiresAt) {
  const target = expiresAt ? Date.parse(expiresAt) : NaN;
  const [seconds, setSeconds] = useState(() => remaining(target));

  useEffect(() => {
    setSeconds(remaining(target));
    if (Number.isNaN(target)) return undefined;
    const id = setInterval(() => setSeconds(remaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return seconds;
}

function remaining(target) {
  return Number.isNaN(target) ? 0 : Math.max(0, Math.ceil((target - Date.now()) / 1000));
}
