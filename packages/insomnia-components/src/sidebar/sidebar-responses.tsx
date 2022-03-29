import React, { Component, ReactNode } from 'react';

import { IconEnum, SvgIcon } from '../svg-icon';
import { Tooltip } from '../tooltip';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export interface SidebarResponsesProps {
  responses: Record<string, any>;
  onClick: (section: string, ...args: any) => void;
}

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarResponses extends Component<SidebarResponsesProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { responses, onClick } = this.props;

    if (Object.prototype.toString.call(responses) !== '[object Object]') {
      return <SidebarInvalidSection name={'response'} />;
    }

    const filteredValues = Object.keys(responses).filter(response =>
      response.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(response => (
          <SidebarItem key={response} onClick={() => onClick('components', 'responses', response)}>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <span>
              <Tooltip message={responses[response].description} position="right">
                {response}
              </Tooltip>
            </span>
          </SidebarItem>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="RESPONSES" renderBody={this.renderBody} />;
  }
}
