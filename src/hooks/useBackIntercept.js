import { useEffect, useRef } from 'react';

/**
 * useBackIntercept — pushes a history entry when an overlay (drawer/modal/popup)
 * mounts and intercepts the browser/phone back gesture so the FIRST back closes
 * the overlay and stays on the page underneath. A second back then navigates
 * normally.
 *
 * Usage (inside an overlay component that is conditionally rendered when open):
 *   useBackIntercept(isOpen, onClose);
 *
 * - Only pushes one entry per open (guarded against double-push).
 * - On unmount/close, if our entry is still on the stack we leave it; the popstate
 *   handler already removed it. If the overlay closed via X/backdrop (not back),
 *   we pop our own entry so the history stack stays clean.
 */
export default function useBackIntercept(isOpen, onClose) {
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Push a sentinel history entry so the back gesture lands on it.
    pushedRef.current = true;
    window.history.pushState({ gc_overlay: true }, '');

    const onPopState = (e) => {
      // Back was pressed while our overlay entry was on top.
      pushedRef.current = false;
      if (onCloseRef.current) onCloseRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // If the overlay closed via its own X/backdrop (not via back), pop the
      // sentinel we pushed so the history stack doesn't accumulate stale entries.
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen]);
}