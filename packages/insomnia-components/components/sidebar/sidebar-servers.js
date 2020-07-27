// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  servers: Array<any>,
  onClick: (section: string, path: Array<mixed>) => void,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarServers extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const { servers, onClick } = this.props;

    const filteredValues = servers.filter(server =>
      server.url.includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map((server, index) => (
          <React.Fragment key={server.url}>
            <SidebarItem>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => onClick('servers', [index])}>{server.url}</span>
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
