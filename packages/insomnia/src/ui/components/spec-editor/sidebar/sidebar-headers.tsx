import React, { Component, Fragment, ReactNode } from 'react';

import { IconEnum, SvgIcon } from '../../svg-icon';
import { Tooltip } from '../../tooltip';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export interface SidebarHeadersProps {
  headers: Record<string, any>;
  onClick: (section: string, ...args: any) => void;
}

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarHeaders extends Component<SidebarHeadersProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { headers, onClick } = this.props;

    if (Object.prototype.toString.call(headers) !== '[object Object]') {
      return <SidebarInvalidSection name={'header'} />;
    }

    const filteredValues = Object.keys(headers).filter(header =>
      header.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(header => (
          <Fragment key={header}>
            <SidebarItem onClick={() => onClick('components', 'headers', header)}>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span>
                <Tooltip message={headers[header].description} position="right">
                  {header}
                </Tooltip>
              </span>
            </SidebarItem>
          </Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="HEADERS" renderBody={this.renderBody} />;
  }
}
