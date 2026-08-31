import { useEffect, useRef } from 'react';

import { NAVIGATION_CHORDS } from './commands';

const CHORD_WINDOW_MS = 1000;

// `g` is an unmodified key, so a chord must never fire while the user is
// typing — otherwise entering "goals" into the quick-add field navigates away
// mid-word.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true
  );
}

export function useGlobalShortcuts({
  onNavigate,
  onOpenPalette,
}: {
  onNavigate: (to: string) => void;
  onOpenPalette: () => void;
}) {
  const pendingChordAtRef = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenPalette();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        pendingChordAtRef.current = null;
        return;
      }

      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const pendingAt = pendingChordAtRef.current;

      if (pendingAt !== null && Date.now() - pendingAt <= CHORD_WINDOW_MS) {
        pendingChordAtRef.current = null;

        const path = NAVIGATION_CHORDS[key];
        if (path) {
          event.preventDefault();
          onNavigate(path);
        }

        return;
      }

      pendingChordAtRef.current = key === 'g' ? Date.now() : null;
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNavigate, onOpenPalette]);
}
