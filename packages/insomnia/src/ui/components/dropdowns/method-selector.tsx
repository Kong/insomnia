import React, { forwardRef, useCallback, useState } from 'react';
import { Button } from 'react-aria-components';

import { HTTP_METHODS } from '../../../common/constants';
import { getMethodPillClasses, getMethodTextClasses } from '../../utils/method-colors';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showModal } from '../modals/index';
import { PromptModal } from '../modals/prompt-modal';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';

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
  const localStorageHttpMethods = window.localStorage.getItem(LOCALSTORAGE_KEY);
  const parsedLocalStorageHttpMethods = localStorageHttpMethods
    ? (JSON.parse(localStorageHttpMethods) as string[])
    : [];
  const [recent, setRecent] = useState(parsedLocalStorageHttpMethods);

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
        const localStorageHttpMethods = window.localStorage.getItem(LOCALSTORAGE_KEY);
        const currentRecent = localStorageHttpMethods ? (JSON.parse(localStorageHttpMethods) as string[]) : [];
        const newRecent = currentRecent.filter(m => m !== methodToDelete);
        setRecent(newRecent);
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(newRecent));
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
        const localStorageHttpMethods = window.localStorage.getItem(LOCALSTORAGE_KEY);
        const currentRecent = localStorageHttpMethods ? (JSON.parse(localStorageHttpMethods) as string[]) : [];
        // Save method as recent
        if (!currentRecent.includes(methodToAdd)) {
          const newRecent = [...currentRecent, methodToAdd];
          setRecent(newRecent);
          window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(newRecent));
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
          className={`flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold uppercase ${getMethodPillClasses(method)} ${className || ''}`}
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
