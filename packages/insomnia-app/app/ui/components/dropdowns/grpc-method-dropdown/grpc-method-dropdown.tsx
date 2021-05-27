import React, { Fragment, FunctionComponent, useMemo } from 'react';
import { Dropdown, DropdownItem, DropdownDivider, Tooltip } from 'insomnia-components';
import type { GrpcMethodDefinition } from '../../../../network/grpc/method';
import styled from 'styled-components';
import GrpcMethodTag from '../../tags/grpc-method-tag';
import {
  getShortGrpcPath,
  groupGrpcMethodsByPackage,
  NO_PACKAGE_KEY,
} from '../../../../common/grpc-paths';
import type { GrpcMethodInfo } from '../../../../common/grpc-paths';
import GrpcMethodDropdownButton from './grpc-method-dropdown-button';

interface Props {
  disabled?: boolean;
  methods: GrpcMethodDefinition[];
  selectedMethod?: GrpcMethodDefinition;
  handleChange: (arg0: string) => Promise<void>;
  handleChangeProtoFile: (arg0: string) => Promise<void>;
}

const NormalCase = styled.span`
  text-transform: initial;
`;

const GrpcMethodDropdown: FunctionComponent<Props> = ({
  disabled,
  methods,
  selectedMethod,
  handleChange,
  handleChangeProtoFile,
}) => {
  const dropdownButton = useMemo(
    () => () => <GrpcMethodDropdownButton fullPath={selectedMethod?.path} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TSCONVERSION this error appears to be correct, actually
    [selectedMethod?.path],
  );
  const groupedByPkg = useMemo(() => groupGrpcMethodsByPackage(methods), [methods]);
  return (
    <Dropdown className="tall wide" renderButton={dropdownButton}>
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
              onClick={handleChange}
              value={fullPath}
              disabled={disabled}
              selected={fullPath === selectedMethod?.path}
              icon={<GrpcMethodTag methodType={type} />}>
              <Tooltip message={fullPath} position="right" delay={500}>
                {getShortGrpcPath(segments, fullPath)}
              </Tooltip>
            </DropdownItem>
          ))}
        </Fragment>
      ))}
    </Dropdown>
  );
};

export default GrpcMethodDropdown;
