import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

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
  onChange: (method: string) => void;
  method: string;
  right?: boolean;
  showGrpc?: boolean;
  className?: string;
}
export const MethodDropdown = forwardRef<{toggle:()=>void}, Props>(({
  method,
  right,
  onChange,
  showGrpc,
  className,
}, ref) => {
  const dropdownRef = useRef<Dropdown>(null);
  const toggle = useCallback(() => {
    if (dropdownRef.current) {
      dropdownRef.current.toggle();
    }
  }, [dropdownRef]);
  useImperativeHandle(ref, () => ({ toggle }), [toggle]
  );
  const _handleSetCustomMethod = () => {
    let recentMethods: string[];

    try {
      const v = window.localStorage.getItem(LOCALSTORAGE_KEY);
      recentMethods = v ? JSON.parse(v) || [] : [];
    } catch (err) {
      recentMethods = [];
    }

    // Prompt user for the method
    showPrompt({
      defaultValue: method,
      title: 'HTTP Method',
      submitName: 'Done',
      upperCase: true,
      selectText: true,
      hint: 'Common examples are LINK, UNLINK, FIND, PURGE',
      label: 'Name',
      placeholder: 'CUSTOM',
      hints: recentMethods,
      onDeleteHint: method => {
        recentMethods = recentMethods.filter(m => m !== method);
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recentMethods));
      },
      onComplete: method => {
        // Don't add empty methods
        if (!method) {
          return;
        }

        // Don't add base methods
        if (constants.HTTP_METHODS.includes(method)) {
          return;
        }

        // Save method as recent
        recentMethods = recentMethods.filter(m => m !== method);
        recentMethods.unshift(method);
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recentMethods));
        // Invoke callback
        onChange(method);
      },
    });
  };

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
          onClick={() => onChange(method)}
        >
          {method}
        </DropdownItem>
      ))}
      {showGrpc && (
        <>
          <DropdownDivider />
          <DropdownItem className="method-grpc" onClick={() => onChange(METHOD_GRPC)}>
            {GRPC_LABEL}
          </DropdownItem>
        </>
      )}
      <DropdownDivider />
      <DropdownItem
        className="http-method-custom"
        onClick={_handleSetCustomMethod}
      >
        Custom Method
      </DropdownItem>
    </Dropdown>
  );
});
MethodDropdown.displayName = 'MethodDropdown';
