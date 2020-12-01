// @flow
import React from 'react';
import { Dropdown, DropdownItem, DropdownDivider, Button } from 'insomnia-components';
import type { GrpcMethodDefinition } from '../../../network/grpc/method';
import styled from 'styled-components';
import { getMethodType } from '../../../network/grpc/method';
import GrpcMethodTag from '../tags/grpc-method-tag';
import { groupBy } from 'lodash';

type Props = {
  disabled: boolean,
  methods: Array<GrpcMethodDefinition>,
  selectedMethod?: GrpcMethodDefinition,
  handleChange: string => Promise<void>,
  handleChangeProtoFile: string => Promise<void>,
};

const PROTO_PATH_REGEX = /^\/(?<package>[\w.]+)\.(?<service>\w+)\/(?<method>\w+)$/;

const getGrpcPathSegments = (path: string) => {
  const result = PROTO_PATH_REGEX.exec(path);

  const pkg = result?.groups?.package;
  const service = result?.groups?.service;
  const method = result?.groups?.method;

  return { pkg, service, method };
};

const SpaceBetween = styled.span`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

type ButtonProps = { fullPath?: string };

const GrpcMethodDropdownButton = ({ fullPath }: ButtonProps) => {
  let text = 'Select Method';
  let title = text;

  if (fullPath) {
    const { service, method } = getGrpcPathSegments(fullPath);

    text = (service && method && `${service}/${method}`) || fullPath;
    title = fullPath;
  }

  return (
    <Button variant="text" size="medium" className="tall wide" title={title}>
      <SpaceBetween>
        {text}
        <i className="fa fa-caret-down pad-left-sm" />
      </SpaceBetween>
    </Button>
  );
};

const GrpcMethodDropdown = ({
  disabled,
  methods,
  selectedMethod,
  handleChange,
  handleChangeProtoFile,
}: Props) => {
  const dropdownButton = React.useMemo(
    () => () => <GrpcMethodDropdownButton fullPath={selectedMethod?.path} />,
    [selectedMethod?.path],
  );

  const groupedByPkg = React.useMemo(() => {
    return groupBy(
      methods.map(method => ({
        segments: getGrpcPathSegments(method.path),
        type: getMethodType(method),
        fullPath: method.path,
      })),
      s => s.segments.pkg,
    );
  }, [methods]);

  return (
    <Dropdown className="tall wide" renderButton={dropdownButton}>
      <DropdownItem onClick={handleChangeProtoFile}>Click to change proto file</DropdownItem>
      {!methods.length && (
        <>
          <DropdownDivider />
          <DropdownItem disabled>No methods found</DropdownItem>
        </>
      )}
      {Object.keys(groupedByPkg).map(pkg => {
        const methodsInPkg = groupedByPkg[pkg];

        return (
          <>
            <DropdownDivider children={pkg} />
            {methodsInPkg.map(({ segments: { service, method }, type, fullPath }) => {
              return (
                <DropdownItem
                  key={fullPath}
                  onClick={handleChange}
                  value={fullPath}
                  disabled={disabled}
                  selected={fullPath === selectedMethod?.path}
                  icon={<GrpcMethodTag methodType={type} />}>
                  {service}/{method}
                </DropdownItem>
              );
            })}
          </>
        );
      })}
    </Dropdown>
  );
};

export default GrpcMethodDropdown;
