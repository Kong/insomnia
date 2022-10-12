import React, { Fragment, FunctionComponent, useMemo } from 'react';
import styled from 'styled-components';

import type { GrpcMethodInfo } from '../../../../common/grpc-paths';
import {
  getGrpcPathSegments,
  getShortGrpcPath,
  groupGrpcMethodsByPackage,
  NO_PACKAGE_KEY,
} from '../../../../common/grpc-paths';
import type { GrpcMethodDefinition } from '../../../../network/grpc/method';
import { Dropdown } from '../../base/dropdown/dropdown';
import { DropdownButton } from '../../base/dropdown/dropdown-button';
import { DropdownDivider } from '../../base/dropdown/dropdown-divider';
import { DropdownItem } from '../../base/dropdown/dropdown-item';
import { GrpcMethodTag } from '../../tags/grpc-method-tag';
import { Button } from '../../themed-button';
import { Tooltip } from '../../tooltip';

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
  methods: GrpcMethodDefinition[];
  selectedMethod?: GrpcMethodDefinition;
  handleChange: (arg0: string) => Promise<void>;
  handleChangeProtoFile: () => Promise<void>;
}

const NormalCase = styled.span`
  text-transform: initial;
`;

export const GrpcMethodDropdown: FunctionComponent<Props> = ({
  disabled,
  methods,
  selectedMethod,
  handleChange,
  handleChangeProtoFile,
}) => {
  const groupedByPkg = useMemo(() => groupGrpcMethodsByPackage(methods), [methods]);
  const useLabel = (fullPath?: string) =>
    useMemo(() => {
      if (fullPath) {
        const segments = getGrpcPathSegments(fullPath);
        return getShortGrpcPath(segments, fullPath);
      }

      return 'Select Method';
    }, [fullPath]);
  return (
    <Dropdown
      className="tall wide"
    >
      <DropdownButton
        buttonClass={DropdownMethodButton}
      >
        <Tooltip message={selectedMethod?.path || 'Select Method'} position="bottom" delay={500}>
          {useLabel(selectedMethod?.path)}
          <i className="fa fa-caret-down pad-left-sm" />
        </Tooltip>
      </DropdownButton>
      <DropdownItem onClick={handleChangeProtoFile}>
        <em>Click to change proto file</em>
      </DropdownItem>
      {!methods.length && (
        <>
          <DropdownDivider />
          <DropdownItem disabled>No methods found</DropdownItem>
        </>
      )}
      {Object.keys(groupedByPkg).map(pkgName => (
        <Fragment key={pkgName}>
          <DropdownDivider>
            {pkgName !== NO_PACKAGE_KEY && <NormalCase>pkg: {pkgName}</NormalCase>}
          </DropdownDivider>
          {groupedByPkg[pkgName].map(({ segments, type, fullPath }: GrpcMethodInfo) => (
            <DropdownItem
              key={fullPath}
              onClick={() => handleChange(fullPath)}
              disabled={disabled}
              selected={fullPath === selectedMethod?.path}
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
