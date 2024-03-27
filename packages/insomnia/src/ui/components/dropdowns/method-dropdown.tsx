import React, { forwardRef, useCallback, useState } from 'react';
import styled from 'styled-components';

import { HTTP_METHODS } from '../../../common/constants';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showPrompt } from '../modals/index';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';

const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    paddingLeft: 'var(--padding-sm)',
  },
});

interface Props {
  className?: string;
  method: string;
  onChange: (method: string) => void;
}

export const MethodDropdown = forwardRef<DropdownHandle, Props>(({
                                                                   className,
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
      className="method-dropdown"
      triggerButton={
        <StyledDropdownButton className={className}>
          <span
            className={
              `w-20 flex text-[0.8rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                            ${{
                'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
              }[method] || 'text-[--color-font] bg-[--hl-md]'}`
            }
          >{method}</span>{' '}
          <i className="fa fa-caret-down space-left" />
        </StyledDropdownButton>
      }
    >
      <DropdownSection>
        {HTTP_METHODS.map(method => (
          <DropdownItem key={method}>
            <span
              className={
                `w-32 ml-10 mr-5 flex text-[1rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                            ${{
                  'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                  'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                  'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                  'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                  'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                  'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                  'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                }[method] || 'text-[--color-font] bg-[--hl-md]'}`
              }
              onClick={() => onChange(method)}
            >&ensp; {method}</span>
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
