'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * Typed localStorage hook with SSR safety.
 *
 * Usage:
 *   const [theme, setTheme] = useLocalStorage('theme', 'light');
 */
export function useLocalStorage<T>(
  key:          string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Sync with localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          // Dispatch storage event so other tabs sync
          window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(valueToStore) }));
        }
      } catch (error) {
        console.warn(`useLocalStorage: error setting key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`useLocalStorage: error removing key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for cross-tab changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setStoredValue(JSON.parse(e.newValue) as T);
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key]);

  return [storedValue, setValue, removeValue];
}
