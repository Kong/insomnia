import React, { forwardRef, useCallback, useState } from 'react';

import * as constants from '../../../common/constants';
import { METHOD_GRPC } from '../../../common/constants';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showPrompt } from '../modals/index';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';
const GRPC_LABEL = 'gRPC';

interface Props {
  className?: string;
  method: string;
  onChange: (method: string) => void;
  right?: boolean;
  showGrpc?: boolean;
}

export const MethodDropdown = forwardRef<DropdownHandle, Props>(({
  className,
  method,
  onChange,
  right,
  showGrpc,
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
        setRecent(recent.filter(m => m !== methodToDelete));
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recent.filter(m => m !== methodToDelete)));
      },
      onComplete: methodToAdd => {
        // Don't add empty methods
        if (!methodToAdd) {
          return;
        }
        // Don't add base methods
        if (constants.HTTP_METHODS.includes(methodToAdd)) {
          return;
        }
        // Save method as recent
        if (recent.includes(methodToAdd)) {
          return;
        }
        setRecent([...recent, methodToAdd]);
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recent));
        onChange(methodToAdd);
      },
    });
  }, [method, onChange, recent]);

  const buttonLabel = method === METHOD_GRPC ? GRPC_LABEL : method;
  return (
    <Dropdown ref={ref} className="method-dropdown" right={right}>
      <DropdownButton className={className}>
        <span className={`http-method-${method}`}>{buttonLabel}</span>{' '}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>

      {constants.HTTP_METHODS.map(method => (
        <DropdownItem
          key={method}
          className={`http-method-${method}`}
          onClick={onChange}
          value={method}
        >
          {method}
        </DropdownItem>
      ))}

      {showGrpc && (
        <>
          <DropdownDivider />
          <DropdownItem className="method-grpc" onClick={onChange} value={METHOD_GRPC}>
            {GRPC_LABEL}
          </DropdownItem>
        </>
      )}

      <DropdownDivider />
      <DropdownItem
        className="http-method-custom"
        onClick={handleSetCustomMethod}
      >
        Custom Method
      </DropdownItem>
    </Dropdown>
  );
});
MethodDropdown.displayName = 'MethodDropdown';
