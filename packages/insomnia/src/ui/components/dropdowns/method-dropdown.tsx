import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import * as constants from '../../../common/constants';
import { METHOD_GRPC } from '../../../common/constants';
import { Dropdown } from '../base/dropdown/dropdown';
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
export interface MethodDropdownHandle {
  toggle: () => void;
}
export const MethodDropdown = forwardRef<MethodDropdownHandle, Props>(({
  className,
  method,
  onChange,
  right,
  showGrpc,
}, ref) => {
  const [recent, setRecent] = useState<string[]>(JSON.parse(window.localStorage.getItem(LOCALSTORAGE_KEY) || '[]'));

  const dropdownRef = useRef<Dropdown>(null);
  const toggle = useCallback(() => {
    if (dropdownRef.current) {
      dropdownRef.current.toggle();
    }
  }, [dropdownRef]);
  useImperativeHandle(ref, () => ({ toggle }), [toggle]);
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
    <Dropdown ref={dropdownRef} className="method-dropdown" right={right}>
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
