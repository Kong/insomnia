import React, { Component, Fragment, ReactNode } from 'react';
import styled from 'styled-components';

import { IconEnum, SvgIcon } from '../../svg-icon';
import { Tooltip } from '../../tooltip';
import { SidebarBadge } from './sidebar-badge';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export interface SidebarRequestsProps {
  requests: Record<string, any>;
  onClick: (section: string, ...args: any) => void;
}

const StyledRequestFormat = styled.span`
  padding-left: var(--padding-sm);
`;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarRequests extends Component<SidebarRequestsProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { requests, onClick } = this.props;

    if (Object.prototype.toString.call(requests) !== '[object Object]') {
      return <SidebarInvalidSection name={'request'} />;
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
            <Fragment key={requestName}>
              <SidebarItem
                gridLayout
                onClick={() => onClick('components', 'requestBodies', requestName)}
              >
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
                <Fragment key={requestFormat}>
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
                        }
                      >
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
                </Fragment>
              ))}
            </Fragment>
          );
        })}
      </div>
    );
  };

  render() {
    return <SidebarSection title="REQUESTS" renderBody={this.renderBody} />;
  }
}
