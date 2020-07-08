// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  servers: Array<any>,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('server');
  itemPath.push.apply(itemPath, items);
  console.log(itemPath);
  itemPath = [];
};
// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarServers extends React.Component<Props> {
  renderBody = (filter: string) => (
    <div>
      {this.props.servers.map(server => (
        <React.Fragment key={server.url}>
          {server.url.includes(filter) && (
            <SidebarItem>
              <div></div>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => handleClick([server.url])}>{server.url}</span>
            </SidebarItem>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  render() {
    return <SidebarSection title="SERVERS" renderBody={this.renderBody} />;
  }
}
