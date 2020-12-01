// @flow
import React from 'react';
import { Dropdown, DropdownItem, Button } from 'insomnia-components';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';
import styled from 'styled-components';

type Props = {
  disabled: boolean,
  methods: Array<GrpcMethodDefinition>,
  selectedMethod?: GrpcMethodDefinition,
  handleChange: string => Promise<void>,
  handleChangeProtoFile: string => Promise<void>,
};

const SpaceBetween = styled.span`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DropdownButton = (props: { text: string }) => (
  <Button variant="text" className="tall wide">
    <SpaceBetween>
      {props.text}
      <i className="fa fa-caret-down pad-left-sm" />
    </SpaceBetween>
  </Button>
);

const GrpcMethodDropdown = ({
  disabled,
  methods,
  selectedMethod,
  handleChange,
  handleChangeProtoFile,
}: Props) => {
  const dropdownButton = React.useMemo(
    () => () => <DropdownButton text={selectedMethod?.path || 'Select Method'} />,
    [selectedMethod?.path],
  );

  return (
    <Dropdown className="tall wide" renderButton={dropdownButton}>
      <DropdownItem onClick={handleChangeProtoFile}>Click to change proto file</DropdownItem>
      {!methods.length && <DropdownItem disabled>No methods found</DropdownItem>}
      {methods.map(method => (
        <DropdownItem
          key={method.path}
          onClick={handleChange}
          value={method.path}
          disabled={disabled}
          icon="SS">
          {method.path}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};

export default GrpcMethodDropdown;
