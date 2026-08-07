import { useEffect, useRef } from 'react';

import { Icon } from '../../icon';

interface SidebarFocusOnboardingProps {
  triggerElement: HTMLElement | null;
  onDismiss: () => void;
}

export const SidebarFocusOnboarding = ({ triggerElement, onDismiss }: SidebarFocusOnboardingProps) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerElement) return;

    const updatePosition = () => {
      if (!popoverRef.current) return;
      const triggerRect = triggerElement.getBoundingClientRect();
      const popover = popoverRef.current;
      popover.style.top = `${triggerRect.top + 78}px`;
      popover.style.left = `${triggerRect.right + 4}px`;
    };

    updatePosition();

    const observer = new ResizeObserver(updatePosition);
    observer.observe(triggerElement);

    return () => observer.disconnect();
  }, [triggerElement]);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-72 rounded-md border border-solid border-(--hl-md) bg-(--color-bg) p-4 shadow-lg"
      role="dialog"
      aria-label="Sidebar focus mode onboarding"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-(--color-font)">Welcome to focus mode</h3>
        <button className="shrink-0 text-(--hl) hover:text-(--color-font)" onClick={onDismiss} aria-label="Dismiss">
          <Icon icon="close" />
        </button>
      </div>
      <p className="mt-2 text-sm text-(--hl)">
        Insomnia now automatically narrows the sidebar to the collection you're working in. Click{' '}
        <span className="font-bold text-(--color-font)">Back to all projects</span> at the top to see everything, or
        turn this off anytime in Preferences with the{' '}
        <span className="font-bold text-(--color-font)">Sidebar focus for collections</span> setting.
      </p>
      <button
        className="mt-3 rounded-md bg-(--color-surprise) px-4 py-1.5 text-sm font-medium text-(--color-font-surprise) transition-colors hover:opacity-90"
        onClick={onDismiss}
      >
        Got It
      </button>
    </div>
  );
};
