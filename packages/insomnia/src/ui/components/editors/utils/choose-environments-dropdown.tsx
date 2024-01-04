import React, { FC } from 'react';
import styled from 'styled-components';

import { Environment } from '../../../../models/environment';
import { Workspace } from '../../../../models/workspace';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  ItemContent,
} from '../../base/dropdown';

const StyledDropdownContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;

  & > .dropdown__text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  i.fa {
    // Bump the drop down caret down a bit
    position: relative;
    top: 1px;
  }
`;

interface Props {
  handleChangeEnvironment: Function;
  workspace: Workspace;
  environments: Environment[];
  activeEnvironment?: Environment | null;
}

export const ChooseEnvironmentsDropdown: FC<Props> = ({
  handleChangeEnvironment,
  workspace,
  environments,
  activeEnvironment,
}) => {
  const baseEnvironment = environments.find(e => e.parentId === workspace._id);
  const subEnvironments = environments
    .filter(e => e.parentId === (baseEnvironment && baseEnvironment._id))
    .sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);
  let description;

  if (!activeEnvironment || activeEnvironment === baseEnvironment) {
    description = 'No Environment';
  } else {
    description = activeEnvironment.name;
  }

  const renderEnvironmentItem = (environment: Environment) => {
    return (
      <DropdownItem
        key={environment._id}
        textValue={environment._id}
        onClick={handleChangeEnvironment}
      >
        <ItemContent
          icon={
            <i
              className="fa fa-random"
              style={{
                // @ts-expect-error -- TSCONVERSION don't set color if undefined
                color: environment.color,
                marginRight: 10,
              }}
            />
          }
          label={
            <span>
              Use <strong>{environment.name}</strong>
            </span>
          }
          onClick={() => handleChangeEnvironment(environment._id)}
        />
      </DropdownItem>
    );
  };

  return (
    <Dropdown
      triggerButton={
        <DropdownButton>
          <StyledDropdownContainer>
            <div>
              {activeEnvironment?.color ? (
                <i
                  className="fa fa-tags space-right"
                  style={{
                    color: activeEnvironment.color,
                  }}
                />
              ) : null}
              {description}
            </div>
            <i className="space-left fa fa-caret-down" />
          </StyledDropdownContainer>
        </DropdownButton>
      }
    >
      {subEnvironments.map(renderEnvironmentItem)}

      <DropdownItem textValue={null}>
        <ItemContent
          icon={<i className="fa fa-empty" />}
          label="No Environment"
          onClick={() => handleChangeEnvironment(null)}
        />
      </DropdownItem>
    </Dropdown>
  );
};
