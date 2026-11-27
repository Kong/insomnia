import { useEffect, useState } from 'react';

export type PaneDirection = 'horizontal' | 'vertical';

/**
 * Pane split direction used by the workspace debug views: forced vertical by
 * settings, otherwise vertical below the narrow-layout breakpoint.
 */
export const usePaneDirection = (forceVerticalLayout: boolean): PaneDirection => {
  const [direction, setDirection] = useState<PaneDirection>(() =>
    forceVerticalLayout || window.matchMedia('(max-width: 880px)').matches ? 'vertical' : 'horizontal',
  );

  useEffect(() => {
    if (forceVerticalLayout) {
      setDirection('vertical');
      return;
    }
    const mediaQuery = window.matchMedia('(max-width: 880px)');
    setDirection(mediaQuery.matches ? 'vertical' : 'horizontal');

    const handleChange = (event: MediaQueryListEvent) => {
      setDirection(event.matches ? 'vertical' : 'horizontal');
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [forceVerticalLayout]);

  return direction;
};
