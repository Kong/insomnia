import React, { forwardRef, useCallback, useState } from 'react';
import { Button } from 'react-aria-components';

import { HTTP_METHODS } from '../../../common/constants';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showPrompt } from '../modals/index';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';

interface Props {
  method: string;
  onChange: (method: string) => void;
}

export const MethodDropdown = forwardRef<DropdownHandle, Props>(({
  method,
  onChange,
}, ref) => {
  const localStorageHttpMethods = window.localStorage.getItem(LOCALSTORAGE_KEY);
  const parsedLocalStorageHttpMethods = localStorageHttpMethods ? JSON.parse(localStorageHttpMethods) as string[] : [];
  const [recent, setRecent] = useState(parsedLocalStorageHttpMethods);

  const handleSetCustomMethod = useCallback(() => {
    showPrompt({
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
        const currentRecent = localStorageHttpMethods ? JSON.parse(localStorageHttpMethods) as string[] : [];
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
        const currentRecent = localStorageHttpMethods ? JSON.parse(localStorageHttpMethods) as string[] : [];
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
      triggerButton={
        <Button className='pl-2' aria-label='Request Method'>
          <span className={`http-method-${method}`}>{method}</span>{' '}
          <i className="fa fa-caret-down space-left" />
        </Button>
      }
    >
      <DropdownSection>
        {HTTP_METHODS.map(method => (
          <DropdownItem key={method}>
            <ItemContent
              className={`http-method-${method}`}
              label={method}
              onClick={() => onChange(method)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>

      <DropdownSection>
        <DropdownItem>
          <ItemContent
            className="http-method-custom"
            label="Custom Method"
            onClick={handleSetCustomMethod}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
});

MethodDropdown.displayName = 'MethodDropdown';
