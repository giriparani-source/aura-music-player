import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any fast-changing value (e.g. search query)
 */
export function useDebounce<T>(value: T, delayMs = 180): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
