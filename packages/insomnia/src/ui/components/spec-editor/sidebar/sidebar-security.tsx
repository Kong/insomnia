import React, { Component, Fragment, ReactNode } from 'react';

import { IconEnum, SvgIcon } from '../../svg-icon';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export interface SidebarSecurityProps {
  security: Record<string, any>;
  onClick: (section: string, ...args: any) => void;
}

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarSecurity extends Component<SidebarSecurityProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { security, onClick } = this.props;

    if (Object.prototype.toString.call(security) !== '[object Object]') {
      return <SidebarInvalidSection name={'security'} />;
    }

    const filteredValues = Object.keys(security).filter(scheme =>
      scheme.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(scheme => (
          <Fragment key={scheme}>
            <SidebarItem onClick={() => onClick('components', 'securitySchemes', scheme)}>
              <div>
                <SvgIcon icon={IconEnum.key} />
              </div>
              <span>{scheme}</span>
            </SidebarItem>
          </Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SECURITY" renderBody={this.renderBody} />;
  }
}
