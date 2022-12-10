import React, { Fragment, FunctionComponent } from 'react';
import styled from 'styled-components';

import type { GrpcMethodInfo, GrpcPathSegments } from '../../../../main/network/grpc';
import { Dropdown } from '../../base/dropdown/dropdown';
import { DropdownButton } from '../../base/dropdown/dropdown-button';
import { DropdownDivider } from '../../base/dropdown/dropdown-divider';
import { DropdownItem } from '../../base/dropdown/dropdown-item';
import { GrpcMethodTag } from '../../tags/grpc-method-tag';
import { Button } from '../../themed-button';
import { Tooltip } from '../../tooltip';

const PROTO_PATH_REGEX = /^\/(?:(?<package>[\w.]+)\.)?(?<service>\w+)\/(?<method>\w+)$/;
const getGrpcPathSegments = (path: string) => ({
  packageName:PROTO_PATH_REGEX.exec(path)?.groups?.package,
  serviceName:PROTO_PATH_REGEX.exec(path)?.groups?.service,
  methodName:PROTO_PATH_REGEX.exec(path)?.groups?.method,
});
// If all segments are found, return a shorter path, otherwise the original path
export const getShortGrpcPath = (
  { packageName, serviceName, methodName }: GrpcPathSegments,
  fullPath: string,
): string => {
  return packageName && serviceName && methodName ? `/${serviceName}/${methodName}` : fullPath;
};

export const NO_PACKAGE_KEY = 'no-package';

function groupBy(list: {}[], keyGetter: (item: any) => string):Record<string, any[]> {
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
  return groupBy(methodInfoList, ({ segments }) => segments.packageName || NO_PACKAGE_KEY);
};

const DropdownMethodButton = styled(Button).attrs({
  variant: 'text',
  size:'medium',
  radius:'0',
  className: 'tall wide',
})({
  height: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

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
      className="tall wide"
    >
      <DropdownButton
        buttonClass={DropdownMethodButton}
        disabled={methods.length === 0 || disabled}
      >
        {methods.length ? <Tooltip message={selectedPath || 'Select Method'} position="bottom" delay={500}>
          {!selectedPath ? 'Select Method' : getShortGrpcPath(getGrpcPathSegments(selectedPath), selectedPath)}
          <i className="fa fa-caret-down pad-left-sm" />
        </Tooltip> : 'Add Proto File'}
      </DropdownButton>

      {Object.entries(groupedByPkg).map(([name, pkg]) => (
        <Fragment key={name}>
          <DropdownDivider>
            {name !== NO_PACKAGE_KEY && <NormalCase>pkg: {name}</NormalCase>}
          </DropdownDivider>
          {pkg.map(({ segments, type, fullPath }) => (
            <DropdownItem
              key={fullPath}
              onClick={() => handleChange(fullPath)}
              disabled={disabled}
              selected={fullPath === selectedPath}
            >
              <Tooltip message={fullPath} position="right" delay={500}>
                <DropdownMethodButtonLabel><GrpcMethodTag methodType={type} /> {getShortGrpcPath(segments, fullPath)}</DropdownMethodButtonLabel>
              </Tooltip>
            </DropdownItem>
          ))}
        </Fragment>
      ))}
    </Dropdown>
  );
};
