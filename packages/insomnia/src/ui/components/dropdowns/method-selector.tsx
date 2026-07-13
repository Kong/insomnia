import React, { forwardRef, useCallback, useState } from 'react';
import { Button } from 'react-aria-components';

import { HTTP_METHODS } from '../../../common/constants';
import { getMethodPillClasses, getMethodTextClasses } from '../../utils/method-colors';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showModal } from '../modals/index';
import { PromptModal } from '../modals/prompt-modal';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';

// Safely read the recent custom methods from localStorage. A corrupted/non-JSON
// value or blocked storage returns an empty list instead of throwing.
const readRecentMethods = (): string[] => {
  try {
    const raw = window.localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
};

// Persist the recent custom methods, ignoring storage failures (e.g. private
// mode / quota / blocked storage) so callers are never blocked by a failed write.
const writeRecentMethods = (methods: string[]): void => {
  try {
    window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(methods));
  } catch {
    // Ignore storage failures.
  }
};

interface Props {
  method: string;
  onChange: (method: string) => void;
  /** Extra classes for the trigger button (e.g. sizing/layout in a given context). */
  className?: string;
}

/**
 * Reusable HTTP method selector.
 *
 * Renders the current method as a filled, theme-coloured pill with a chevron and
 * opens a dropdown to pick another method (plus a custom-method option). Self
 * contained so it can be dropped into any surface that needs method selection.
 */
export const MethodSelector = forwardRef<DropdownHandle, Props>(({ method, onChange, className }, ref) => {
  const [recent, setRecent] = useState(readRecentMethods);

  const handleSetCustomMethod = useCallback(() => {
    showModal(PromptModal, {
      defaultValue: method,
      title: 'HTTP Method',
      submitName: 'Done',
      upperCase: true,
      selectText: true,
      hint: 'Common examples are LINK, UNLINK, FIND, PURGE',
      label: 'Name',
      placeholder: 'CUSTOM',
      hints: recent,
      onDeleteHint: methodToDelete => {
        // Note: We need to read and remove the method from localStorage and not rely on react state
        // It solves the case where you try to delete more than one method at a time, because recent is updated only once
        const currentRecent = readRecentMethods();
        const newRecent = currentRecent.filter(m => m !== methodToDelete);
        setRecent(newRecent);
        writeRecentMethods(newRecent);
      },
      onComplete: methodToAdd => {
        // Don't add empty methods
        if (!methodToAdd) {
          return;
        }
        // Don't add base methods
        if (HTTP_METHODS.includes(methodToAdd)) {
          return;
        }

        // Note: We need to read and remove the method from localStorage and not rely on react state
        // It solves the case where you try to add a new method after you deleted some others
        const currentRecent = readRecentMethods();
        // Save method as recent
        if (!currentRecent.includes(methodToAdd)) {
          const newRecent = [...currentRecent, methodToAdd];
          setRecent(newRecent);
          writeRecentMethods(newRecent);
        }
        onChange(methodToAdd);
      },
    });
  }, [method, onChange, recent]);

  return (
    <Dropdown
      ref={ref}
      aria-label="Request Method"
      triggerButton={
        <Button
          aria-label="Request Method"
          className={`flex items-center gap-1 rounded-sm px-2 py-1 text-center text-[12px]/[100%] font-[590] uppercase ${getMethodPillClasses(method)} ${className || ''}`}
        >
          <span>{method}</span>
          <i className="fa fa-caret-down" />
        </Button>
      }
    >
      <DropdownSection>
        {HTTP_METHODS.map(m => (
          <DropdownItem key={m}>
            <ItemContent
              className={getMethodTextClasses(m)}
              label={m}
              isSelected={m === method}
              onClick={() => onChange(m)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>

      <DropdownSection>
        <DropdownItem>
          <ItemContent
            className={getMethodTextClasses('')}
            label="Custom Method"
            isSelected={!HTTP_METHODS.includes(method)}
            onClick={handleSetCustomMethod}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
});

MethodSelector.displayName = 'MethodSelector';
