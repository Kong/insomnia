import React, { Component, Fragment, ReactNode } from 'react';

import { IconEnum, SvgIcon } from '../../svg-icon';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export interface SidebarServer {
  url: string;
}

export interface SidebarServersProps {
  servers: SidebarServer[];
  onClick: (section: string, path: string | number) => void;
}

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarServers extends Component<SidebarServersProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { servers, onClick } = this.props;

    if (!Array.isArray(servers)) {
      return <SidebarInvalidSection name={'server'} />;
    }

    const filteredValues = servers.filter(server =>
      server.url.includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map((server, index) => (
          <Fragment key={server.url}>
            <SidebarItem onClick={() => onClick('servers', index)}>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span>{server.url}</span>
            </SidebarItem>
          </Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SERVERS" renderBody={this.renderBody} />;
  }
}
