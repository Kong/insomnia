// @flow
import React from 'react';
import { Dropdown, DropdownItem, DropdownDivider, Button } from 'insomnia-components';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';
import styled from 'styled-components';
import { getMethodType } from '../../../network/grpc/method';
import GrpcMethodTag from '../tags/grpc-method-tag';

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
  <Button variant="text" size="medium" className="tall wide" title={props.text}>
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
      <DropdownDivider />
      {!methods.length && <DropdownItem disabled>No methods found</DropdownItem>}
      {methods.map(method => (
        <DropdownItem
          key={method.path}
          onClick={handleChange}
          value={method.path}
          disabled={disabled}
          selected={method.path === selectedMethod?.path}
          icon={<GrpcMethodTag methodType={getMethodType(method)} />}>
          {method.path}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};

export default GrpcMethodDropdown;
