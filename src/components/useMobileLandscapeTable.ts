import { useSyncExternalStore } from 'react';

// Keep this in sync with the phone table media query in index.css.
const query = '(orientation: landscape) and (pointer: coarse) and (max-height: 500px) and (max-width: 1000px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia?.(query).matches ?? false;
}

export function useMobileLandscapeTable() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
