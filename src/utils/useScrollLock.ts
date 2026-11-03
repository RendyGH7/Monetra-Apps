import { useEffect } from 'react';

// Global counter to gracefully handle stacked or multiple modals
let activeLockCount = 0;
let previousOverflow = '';
let previousOverscroll = '';

/**
 * Custom React hook to reliably lock background web scrolling when a modal or pop-up is open.
 * When isLocked is false, the web scrolls freely without any restriction.
 * When isLocked is true, body scroll is locked so the background is not disturbed.
 * Upon closing, background scroll is automatically restored.
 */
export const useScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) return;

    if (activeLockCount === 0) {
      previousOverflow = document.body.style.overflow;
      previousOverscroll = document.body.style.overscrollBehavior;

      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'contain';
    }

    activeLockCount++;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0) {
        document.body.style.overflow = previousOverflow || '';
        document.body.style.overscrollBehavior = previousOverscroll || '';
        // Clear any old inline styles if any existed
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.touchAction = '';
      }
    };
  }, [isLocked]);
};
