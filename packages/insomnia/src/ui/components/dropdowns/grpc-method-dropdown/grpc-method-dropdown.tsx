import React, { FunctionComponent } from 'react';
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
}) => {
  const groupedByPkg = groupGrpcMethodsByPackage(methods);
  const selectedPath = selectedMethod?.fullPath;

  return (
    <Dropdown
      aria-label='Select gRPC method dropdown'
      className="tall wide"
      isDisabled={methods.length === 0}
      triggerButton={
        <DropdownButton
          size='medium'
          className='tall wide'
          removeBorderRadius
          removePaddings={false}
          disableHoverBehavior={false}
          isDisabled={methods.length === 0}
          style={{ maxWidth: '250px' }}
        >
          <Tooltip
            message={selectedPath || 'Add proto file or use server reflection'}
            position="bottom"
            delay={500}
            style={{ maxWidth: '240px', display: 'flex', alignItems: 'center' }}
          >
            <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {!selectedPath ? 'Select Method' : getShortGrpcPath(selectedPath)}
            </span>
            <i className="fa fa-caret-down pad-left-sm" />
          </Tooltip>
        </DropdownButton>
      }
    >
      {Object.entries(groupedByPkg).map(([name, pkg]) => (
        <DropdownSection
          key={name}
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
                isSelected={fullPath === selectedPath}
                onClick={() => handleChange(fullPath)}
              >
                <Tooltip message={fullPath} position="right" delay={500}>
                  <DropdownMethodButtonLabel><GrpcMethodTag methodType={type} /> {getShortGrpcPath(fullPath)}</DropdownMethodButtonLabel>
                </Tooltip>
              </ItemContent>
            </DropdownItem>
          ))}
        </DropdownSection>
      ))}
    </Dropdown>
  );
};
