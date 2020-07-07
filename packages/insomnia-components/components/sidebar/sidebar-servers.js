// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';

type Props = {
  servers: Array<any>,
  children?: React.Node,
  filter: string,
};

const SidebarServers = ({ servers, filter, children }: Props) => (
  <div>
    {servers.map(server => (
      <React.Fragment key={server.url}>
        {server.url.includes(filter) && (
          <SidebarItem>
            <div></div>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <span>{server.url}</span>
          </SidebarItem>
        )}
      </React.Fragment>
    ))}
  </div>
);

export default SidebarServers;
