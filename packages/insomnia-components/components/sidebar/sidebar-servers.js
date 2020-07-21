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
  itemPath = [];
};
// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarServers extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = this.props.servers.filter(server =>
      server.url.includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(server => (
          <React.Fragment key={server.url}>
            <SidebarItem>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => handleClick([server.url])}>{server.url}</span>
            </SidebarItem>
          </React.Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SERVERS" renderBody={this.renderBody} />;
  }
}
