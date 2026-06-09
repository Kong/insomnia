import { useEffect, useRef } from 'react';

import { Icon } from '../../icon';

interface KonnectEnvOnboardingProps {
  triggerElement: HTMLElement | null;
  onDismiss: () => void;
}

export const KonnectEnvOnboarding = ({ triggerElement, onDismiss }: KonnectEnvOnboardingProps) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerElement) return;

    const updatePosition = () => {
      if (!popoverRef.current) return;
      const triggerRect = triggerElement.getBoundingClientRect();
      const popover = popoverRef.current;
      popover.style.top = `${triggerRect.top}px`;
      popover.style.left = `${triggerRect.right + 8}px`;
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
      aria-label="Konnect environment onboarding"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-(--color-font)">
          Almost ready! Just set your proxy host for each control plane
        </h3>
        <button className="shrink-0 text-(--hl) hover:text-(--color-font)" onClick={onDismiss} aria-label="Dismiss">
          <Icon icon="close" />
        </button>
      </div>
      <p className="mt-2 text-sm text-(--hl)">
        Your requests have been automatically set with a{' '}
        <code className="rounded-xs bg-(--hl-xs) px-1 py-0.5 font-bold text-(--color-font)">proxy_host</code>{' '}
        environment variable for quick testing against different deployment stages. Enter it here before testing your
        gateway routes.
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
