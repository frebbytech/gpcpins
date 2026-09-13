import { useMemo, useRef, useEffect } from "react";
import _ from "lodash";

/**
 * Returns a debounced version of `callback` that stays stable across
 * renders (so it's safe in dependency arrays) while always calling the
 * latest `callback` closure — avoids the classic "stale closure in a
 * debounced handler" bug.
 */
export function useDebouncedCallback(callback, delayMs = 350) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useMemo(
    () => _.debounce((...args) => callbackRef.current(...args), delayMs),
    [delayMs],
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
}
