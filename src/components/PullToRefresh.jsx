import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

// Pull-to-refresh for mobile WebView. Attaches touch listeners to the
// document and detects a swipe-down while the page is scrolled to the top.
// On release past the threshold it calls onRefresh (typically a React Query
// refetch). Renders a fixed indicator at the top of the viewport.
//
// Usage: <PullToRefresh onRefresh={() => queryClient.invalidateQueries()}>
//          {children}
//        </PullToRefresh>
// Or mount it once (without children) on a page and pass onRefresh.

const THRESHOLD = 70;
const MAX_PULL = 100;

export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const active = useRef(false);

  useEffect(() => {
    // Only enable on touch / coarse-pointer devices.
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    const onTouchStart = (e) => {
      if (refreshing) return;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY <= 0) {
        startY.current = e.touches[0].clientY;
        active.current = true;
      } else {
        active.current = false;
      }
    };

    const onTouchMove = (e) => {
      if (!active.current || startY.current == null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { setPull(0); return; }
      // Apply a resistance curve so the pull feels elastic.
      const eased = Math.min(MAX_PULL, delta * 0.5);
      setPull(eased);
    };

    const onTouchEnd = async () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      if (pull >= THRESHOLD && onRefresh && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await Promise.resolve(onRefresh());
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none transition-transform"
        style={{ transform: `translateY(${pull - (refreshing ? 0 : pull * (1 - progress))}px)` }}>
        <div className="mt-2 flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-md border border-slate-200"
          style={{ opacity: refreshing ? 1 : progress }}>
          {refreshing
            ? <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            : <ArrowDown className={`w-5 h-5 text-emerald-600 transition-transform`} style={{ transform: `rotate(${progress * 180}deg)` }} />}
        </div>
      </div>
      {children}
    </>
  );
}