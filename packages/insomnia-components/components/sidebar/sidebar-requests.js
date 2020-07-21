// @flow
import * as React from 'react';
import styled from 'styled-components';
import Tooltip from '../tooltip';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  requests: Object,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('request');
  itemPath.push.apply(itemPath, items);
  itemPath = [];
};

const StyledRequestExample: React.ComponentType<{}> = styled.span`
  color: var(--color-success);
  &:first-of-type {
    padding-left: var(--padding-lg);
  }
`;

const StyledRequestFormat: React.ComponentType<{}> = styled.span`
  padding-left: var(--padding-sm);
`;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarRequests extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = Object.keys(this.props.requests).filter(requestName =>
      requestName.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(requestName => {
          const { description, content } = this.props.requests[requestName];
          return (
            <React.Fragment key={requestName}>
              <SidebarItem gridLayout>
                <div>
                  <SvgIcon icon={IconEnum.folderOpen} />
                </div>
                <span onClick={() => handleClick([requestName])}>
                  <Tooltip message={description} position="right">
                    {requestName}
                  </Tooltip>
                </span>
              </SidebarItem>
              {Object.keys(content).map(requestFormat => (
                <React.Fragment key={requestFormat}>
                  <SidebarItem>
                    <StyledRequestFormat>
                      <SvgIcon icon={IconEnum.indentation} />
                      <span onClick={() => handleClick([requestFormat])}>{requestFormat}</span>
                    </StyledRequestFormat>
                  </SidebarItem>
                  <SidebarItem>
                    {Object.keys(content[requestFormat].examples).map(requestExample => (
                      <StyledRequestExample
                        onClick={() => handleClick([requestExample])}
                        key={requestExample}>
                        {requestExample}
                      </StyledRequestExample>
                    ))}
                  </SidebarItem>
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  render() {
    return <SidebarSection title="REQUESTS" renderBody={this.renderBody} />;
  }
}
