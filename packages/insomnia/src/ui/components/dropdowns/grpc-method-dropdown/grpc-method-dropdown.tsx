import React, { Fragment, FunctionComponent } from 'react';
import styled from 'styled-components';

import type { GrpcMethodInfo } from '../../../../main/ipc/grpc';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../../base/dropdown';
import { GrpcMethodTag } from '../../tags/grpc-method-tag';
import { Tooltip } from '../../tooltip';

const DropdownMethodButtonLabel = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-xs)',
});

interface Props {
  disabled?: boolean;
  methods: GrpcMethodInfo[];
  selectedMethod?: GrpcMethodInfo;
  handleChange: (arg0: string) => void;
  handleChangeProtoFile: () => void;
  handleServerReflection: () => void;
}
const PROTO_PATH_REGEX = /^\/(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/;

export const NO_PACKAGE_KEY = 'no-package';

function groupBy(list: {}[], keyGetter: (item: any) => string): Record<string, any[]> {
  const map = new Map();
  list.forEach(item => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return Object.fromEntries(map);
}

export const groupGrpcMethodsByPackage = (methodInfoList: GrpcMethodInfo[]): Record<string, GrpcMethodInfo[]> => {
  return groupBy(methodInfoList, ({ fullPath }) => PROTO_PATH_REGEX.exec(fullPath)?.groups?.package || NO_PACKAGE_KEY);
};

// If all segments are found, return a shorter path, otherwise the original path
export const getShortGrpcPath = (fullPath: string): string => {
  const result = PROTO_PATH_REGEX.exec(fullPath);
  const packageName = result?.groups?.package;
  const serviceName = result?.groups?.service;
  const methodName = result?.groups?.method;
  return packageName && serviceName && methodName ? `/${serviceName}/${methodName}` : fullPath;
};
const NormalCase = styled.span`
  text-transform: initial;
`;

export const GrpcMethodDropdown: FunctionComponent<Props> = ({
  disabled,
  methods,
  selectedMethod,
  handleChange,
  handleChangeProtoFile,
  handleServerReflection,
}) => {
  const groupedByPkg = groupGrpcMethodsByPackage(methods);
  const selectedPath = selectedMethod?.fullPath;

  return (
    <Dropdown
      aria-label='Select gRPC method dropdown'
      className="tall wide"
      triggerButton={
        <DropdownButton
          size='medium'
          className='tall wide'
          removeBorderRadius
          disableHoverBehavior={false}
        >
          <Tooltip message={selectedPath || 'Select Method'} position="bottom" delay={500}>
            {!selectedPath ? 'Select Method' : getShortGrpcPath(selectedPath)}
            <i className="fa fa-caret-down pad-left-sm" />
          </Tooltip>
        </DropdownButton>
      }
    >
      <DropdownItem aria-label='Click to use server reflection'>
        <ItemContent
          label={<em>Click to use server reflection</em>}
          onClick={handleServerReflection}
        />
      </DropdownItem>
      <DropdownItem aria-label='Click to change proto file'>
        <ItemContent
          label={<em>Click to change proto file</em>}
          onClick={handleChangeProtoFile}
        />
      </DropdownItem>
      {!methods.length && (
        <DropdownSection>
          <DropdownItem aria-label='No methods found'>No methods found</DropdownItem>
        </DropdownSection>
      )}
      {Object.entries(groupedByPkg).map(([name, pkg]) => (
        <Fragment key={name}>
          <DropdownSection
            aria-label='Select gRPC method section'
            title={name !== NO_PACKAGE_KEY && <NormalCase>pkg: {name}</NormalCase>}
          >
            {pkg.map(({ type, fullPath }) => (
              <DropdownItem
                key={fullPath}
                aria-label={fullPath}
              >
                <ItemContent
                  isDisabled={disabled}
                  // selected={fullPath === selectedPath}
                  onClick={() => handleChange(fullPath)}
                >
                  <Tooltip message={fullPath} position="right" delay={500}>
                    <DropdownMethodButtonLabel><GrpcMethodTag methodType={type} /> {getShortGrpcPath(fullPath)}</DropdownMethodButtonLabel>
                  </Tooltip>
                </ItemContent>
              </DropdownItem>
            ))}
          </DropdownSection>
        </Fragment>
      ))}
    </Dropdown>
  );
};
