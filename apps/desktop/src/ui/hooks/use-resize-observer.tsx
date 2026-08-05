import { useEffect, useRef } from 'react';

export interface Size {
  width: number | undefined;
  height: number | undefined;
}

export const useResizeObserver = (ref: React.RefObject<HTMLElement>, onResize: (size: Size) => void) => {
  const onResizeRef = useRef<((size: Size) => void) | undefined>(undefined);
  onResizeRef.current = onResize;

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      onResizeRef.current?.({ width, height });
    });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref]);
};
