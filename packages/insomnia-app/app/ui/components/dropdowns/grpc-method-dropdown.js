// @flow
import React from 'react';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';

type Props = {
  methods: Array<GrpcMethodDefinition>,
  selectedMethod?: GrpcMethodDefinition,
  handleChange: string => Promise<void>,
};

const GrpcMethodDropdown = ({ methods, selectedMethod, handleChange }: Props) => (
  <Dropdown>
    <DropdownButton>
      {selectedMethod?.path || 'Select Method'}
      <i className="fa fa-caret-down" />
    </DropdownButton>
    {!methods.length && <DropdownItem disabled>No methods found</DropdownItem>}
    {methods.map(({ path }) => (
      <DropdownItem key={path} onClick={handleChange} value={path}>
        {path === selectedMethod?.path && <i className="fa fa-check" />}
        {path}
      </DropdownItem>
    ))}
  </Dropdown>
);

export default GrpcMethodDropdown;
