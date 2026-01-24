import { useState, useEffect, useCallback, useRef } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  openInNewTab?: boolean;
}

interface UsePriorityNavProps {
  items: NavItem[];
  containerRef: React.RefObject<HTMLElement>;
  moreButtonWidth?: number;
  userMenuWidth?: number;
  itemGap?: number;
}

interface UsePriorityNavResult {
  visibleItems: NavItem[];
  overflowItems: NavItem[];
  measureRef: (node: HTMLElement | null, index: number) => void;
}

/**
 * Hook that dynamically calculates which nav items fit in available space
 * and which should overflow into a "More" dropdown menu.
 */
export function usePriorityNav({
  items,
  containerRef,
  moreButtonWidth = 80,
  userMenuWidth = 120,
  itemGap = 4,
}: UsePriorityNavProps): UsePriorityNavResult {
  const [visibleCount, setVisibleCount] = useState(items.length);
  const itemWidthsRef = useRef<Map<number, number>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const measureRef = useCallback((node: HTMLElement | null, index: number) => {
    if (node) {
      itemWidthsRef.current.set(index, node.offsetWidth);
    }
  }, []);

  const calculateVisibleItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const reservedSpace = moreButtonWidth + userMenuWidth + itemGap * 2;
    const availableWidth = containerWidth - reservedSpace;

    let usedWidth = 0;
    let count = 0;

    for (let i = 0; i < items.length; i++) {
      const itemWidth = itemWidthsRef.current.get(i) || 100; // fallback width
      const widthWithGap = itemWidth + (i > 0 ? itemGap : 0);

      if (usedWidth + widthWithGap <= availableWidth) {
        usedWidth += widthWithGap;
        count++;
      } else {
        break;
      }
    }

    // Always show at least 1 item if possible
    setVisibleCount(Math.max(1, count));
  }, [containerRef, items.length, moreButtonWidth, userMenuWidth, itemGap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial calculation after a brief delay to allow items to render
    const timeoutId = setTimeout(calculateVisibleItems, 50);

    // Set up resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      calculateVisibleItems();
    });

    resizeObserverRef.current.observe(container);

    return () => {
      clearTimeout(timeoutId);
      resizeObserverRef.current?.disconnect();
    };
  }, [containerRef, calculateVisibleItems]);

  // Recalculate when items change
  useEffect(() => {
    calculateVisibleItems();
  }, [items, calculateVisibleItems]);

  return {
    visibleItems: items.slice(0, visibleCount),
    overflowItems: items.slice(visibleCount),
    measureRef,
  };
}
