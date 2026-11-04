import { isMac } from 'insomnia-data/common';
import { type FC, type MouseEvent, useEffect, useState } from 'react';

// macOS keeps the native global menu, so this only renders on Windows and Linux
export const TitleBarMenu: FC = () => {
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!isMac) {
      window.main.getAppMenuLabels().then(setLabels);
    }
  }, []);

  const showMenu = (label: string, event: MouseEvent<HTMLButtonElement>) => {
    const { left, bottom } = event.currentTarget.getBoundingClientRect();
    window.main.showAppMenu({ label, x: left, y: bottom });
  };

  return (
    <div role="menubar" aria-label="Application menu" className="flex h-full items-center">
      {labels.map(label => (
        <button
          key={label}
          role="menuitem"
          className="h-[22px] px-2 rounded text-xs text-(--color-font) opacity-80 hover:opacity-100 hover:bg-(--hl-sm) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--color-surprise) transition-colors"
          onClick={event => showMenu(label, event)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
