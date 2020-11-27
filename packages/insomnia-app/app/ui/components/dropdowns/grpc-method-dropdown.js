// @flow
import React from 'react';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';

type Props = {
  disabled: boolean,
  methods: Array<GrpcMethodDefinition>,
  selectedMethod?: GrpcMethodDefinition,
  handleChange: string => Promise<void>,
  handleChangeProtoFile: string => Promise<void>,
};

const GrpcMethodDropdown = ({
  disabled,
  methods,
  selectedMethod,
  handleChange,
  handleChangeProtoFile,
}: Props) => (
  <Dropdown>
    <DropdownButton>
      {selectedMethod?.path || 'Select Method'}
      <i className="fa fa-caret-down" />
    </DropdownButton>
    <DropdownItem onClick={handleChangeProtoFile}>Click to change proto file</DropdownItem>
    {!methods.length && <DropdownItem disabled>No methods found</DropdownItem>}
    {methods.map(({ path }) => (
      <DropdownItem key={path} onClick={handleChange} value={path} disabled={disabled}>
        {path === selectedMethod?.path && <i className="fa fa-check" />}
        {path}
      </DropdownItem>
    ))}
  </Dropdown>
);

export default GrpcMethodDropdown;
