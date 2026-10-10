/**
 * localStorage / sessionStorage access that never throws (private mode,
 * disabled storage, SSR).
 */
type Kind = 'localStorage' | 'sessionStorage';

const area = (kind: Kind): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window[kind];
  } catch {
    return undefined;
  }
};

export function readStorage(key: string, kind: Kind = 'localStorage'): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string, kind: Kind = 'localStorage'): void {
  try {
    area(kind)?.setItem(key, value);
  } catch {
    // Storage full or blocked: preferences simply do not persist.
  }
}
