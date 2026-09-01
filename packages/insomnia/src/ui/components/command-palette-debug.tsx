import React, { useEffect, useRef, useState } from 'react';

import { useCommandPaletteItems } from '~/ui/hooks/use-command-palette-items';
import { isPrimaryClickModifier } from '~/ui/utils';

const log = (...args: unknown[]) => {
  console.log('[command-palette-debug]', new Date().toISOString(), ...args);
};

// Plain, non-react-aria stand-in for CommandPaletteCombobox, used to check whether the
// command-palette freeze-on-clear bug reproduces without the react-aria ComboBox involved.
// Enable via: localStorage.setItem('debugComboBox', '1')
export const CommandPaletteDebugCombobox = ({ close }: { close: () => void }) => {
  const {
    workspaceId,
    requestId,
    comboboxSections,
    isLoadingComboboxItems,
    inputValue,
    search,
    closeWithAbort,
    isPullingFile,
    pullingFile,
  } = useCommandPaletteItems({ close });

  const [isOpen, setIsOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const flatItems = comboboxSections.flatMap(section => section.children);

  useEffect(() => {
    log('mount');
    inputRef.current?.focus();
    return () => log('unmount');
  }, []);

  useEffect(() => {
    log(
      'render, sections:',
      comboboxSections.map(s => `${s.name}=${s.children.length}`).join(', '),
      'total:',
      flatItems.length,
      'inputValue:',
      JSON.stringify(inputValue),
    );
    setActiveIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comboboxSections]);

  return (
    <div className="flex flex-col bg-(--color-bg)">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          value={inputValue}
          disabled={isPullingFile}
          placeholder={
            isPullingFile
              ? `Pulling: ${pullingFile?.name}`
              : 'Search and switch between requests, collections and documents (DEBUG combobox)'
          }
          className="w-full rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-3 pr-7 pl-4 text-(--color-font)"
          onFocus={() => {
            log('input focus');
            setIsOpen(true);
          }}
          onChange={e => {
            const value = e.target.value;
            log('input change ->', JSON.stringify(value));
            search(value);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              log('escape -> closeWithAbort');
              closeWithAbort();
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(i => Math.min(i + 1, flatItems.length - 1));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(i => Math.max(i - 1, 0));
              return;
            }
            if (e.key === 'Enter') {
              const item = flatItems[activeIndex];
              log('enter -> action', item?.id);
              item?.action();
            }
          }}
        />
        {isLoadingComboboxItems && <span className="absolute right-4 text-xs text-(--hl)">loading...</span>}
      </div>
      {isOpen && (
        <div className="max-h-[400px] overflow-y-auto rounded-b-md border border-solid border-(--hl-sm)">
          {flatItems.length === 0 && <div className="p-4 text-sm text-(--hl)">No results</div>}
          {comboboxSections.map(section => (
            <div key={section.id}>
              <div className="p-2 text-xs text-(--hl) uppercase select-none">{section.name}</div>
              {section.children.map(item => {
                const flatIndex = flatItems.indexOf(item);
                return (
                  <div
                    key={item.id}
                    className={`flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 ${
                      flatIndex === activeIndex ? 'bg-(--hl-sm)' : ''
                    } ${item.id === workspaceId || item.id === requestId ? 'font-bold text-(--color-font)' : 'text-(--hl)'}`}
                    onClick={e => {
                      log('click -> action', item.id);
                      item.action(isPrimaryClickModifier(e));
                    }}
                  >
                    {item.icon}
                    <span className="shrink-0 truncate px-1">{item.name}</span>
                    <span className="flex-1 truncate px-1 text-sm text-(--hl-md)">{item.description}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
