import React, { Fragment, FunctionComponent } from 'react';
import styled from 'styled-components';

import {
  getGrpcPathSegments,
  getShortGrpcPath,
  groupGrpcMethodsByPackage,
  GrpcMethodInfo,
  NO_PACKAGE_KEY,
} from '../../../../common/grpc-paths';
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
  methods: GrpcMethodInfo[];
  selectedMethod?: GrpcMethodInfo;
  handleChange: (arg0: string) => void;
  handleChangeProtoFile: () => void;
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
  const groupedByPkg = groupGrpcMethodsByPackage(methods);
  const selectedPath = selectedMethod?.fullPath;

  return (
    <Dropdown
      className="tall wide"
    >
      <DropdownButton
        buttonClass={DropdownMethodButton}
      >
        <Tooltip message={selectedPath || 'Select Method'} position="bottom" delay={500}>
          {!selectedPath ? 'Select Method' : getShortGrpcPath(getGrpcPathSegments(selectedPath), selectedPath)}
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
