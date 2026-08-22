import { useEffect, useRef } from 'react';

/**
 * useBackIntercept — pushes a history entry when an overlay (drawer/modal/popup)
 * mounts and intercepts the browser/phone back gesture so the FIRST back closes
 * the topmost overlay and stays on the page underneath. A second back then
 * navigates normally.
 *
 * Uses a module-level stack + suppress flag so nested overlays behave correctly:
 *  - Back gesture closes only the topmost overlay.
 *  - Closing an overlay via its X/backdrop pops its own sentinel without
 *    wrongly closing the overlay beneath it (suppress flag swallows the
 *    resulting popstate).
 *
 * Usage (inside an overlay component):
 *   useBackIntercept(isOpen, onClose);
 */
const stack = [];
let suppressClose = false;

export default function useBackIntercept(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const entryRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const entry = { close: () => onCloseRef.current?.(), handled: false };
    entryRef.current = entry;
    stack.push(entry);
    window.history.pushState({ gc_overlay: true }, '');

    const onPopState = () => {
      if (suppressClose) { suppressClose = false; return; }
      const top = stack[stack.length - 1];
      if (top && !top.handled) {
        top.handled = true;
        stack.pop();
        top.close();
      }
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      const idx = stack.indexOf(entry);
      if (idx !== -1) stack.splice(idx, 1);
      // Closed via X/backdrop (not via back) — pop our sentinel so the history
      // stack stays clean. Suppress the spurious popstate so an overlay beneath
      // isn't wrongly closed.
      if (entryRef.current && !entry.handled) {
        entry.handled = true;
        suppressClose = true;
        window.history.back();
      }
      entryRef.current = null;
    };
  }, [isOpen]);
}