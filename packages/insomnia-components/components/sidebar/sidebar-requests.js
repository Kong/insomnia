// @flow
import * as React from 'react';
import styled from 'styled-components';
import Tooltip from '../tooltip';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';
import SidebarBadge from './sidebar-badge';
import StyledInvalidSection from './sidebar-invalid-section';

type Props = {
  requests: Object,
  onClick: (section: string, ...args: any) => void,
};

const StyledRequestFormat: React.ComponentType<{}> = styled.span`
  padding-left: var(--padding-sm);
`;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarRequests extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const { requests, onClick } = this.props;

    if (Object.prototype.toString.call(requests) !== '[object Object]') {
      return <StyledInvalidSection name={'request'} />;
    }

    const filteredValues = Object.keys(requests).filter(requestName =>
      requestName.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(requestName => {
          const { description, content } = requests[requestName];
          return (
            <React.Fragment key={requestName}>
              <SidebarItem
                gridLayout
                onClick={() => onClick('components', 'requestBodies', requestName)}>
                <div>
                  <SvgIcon icon={IconEnum.folderOpen} />
                </div>
                <span>
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
                      <span
                        onClick={() =>
                          onClick(
                            'components',
                            'requestBodies',
                            requestName,
                            'content',
                            requestFormat,
                          )
                        }>
                        {requestFormat}
                      </span>
                    </StyledRequestFormat>
                  </SidebarItem>
                  {content[requestFormat].examples && (
                    <SidebarItem>
                      {Object.keys(content[requestFormat].examples).map(requestExample => (
                        <SidebarBadge
                          key={requestExample}
                          label={requestExample}
                          onClick={() =>
                            onClick(
                              'components',
                              'requestBodies',
                              requestName,
                              'content',
                              requestFormat,
                              'examples',
                              requestExample,
                            )
                          }
                        />
                      ))}
                    </SidebarItem>
                  )}
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
