import React, { Component, ReactNode } from 'react';

import { IconEnum, SvgIcon } from '../../svg-icon';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export interface SidebarSchemasProps {
  schemas: Record<string, any>;
  onClick: (section: string, ...args: any) => void;
}

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarSchemas extends Component<SidebarSchemasProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { schemas, onClick } = this.props;

    if (Object.prototype.toString.call(schemas) !== '[object Object]') {
      return <SidebarInvalidSection name={'schema'} />;
    }

    const filteredValues = Object.keys(schemas).filter(schema =>
      schema.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(schema => (
          <SidebarItem key={schema} onClick={() => onClick('components', 'schemas', schema)}>
            <div>
              <SvgIcon icon={IconEnum.brackets} />
            </div>
            <span>{schema}</span>
          </SidebarItem>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SCHEMAS" renderBody={this.renderBody} />;
  }
}
