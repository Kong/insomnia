// @flow
import * as React from 'react';
import SidebarPanel from './sidebar-panel';
import SidebarBlockItem from './sidebar-block-item';

type Props = {
  info: Object,
  parent: boolean,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarInfo extends React.Component<Props> {
  render() {
    return (
      <SidebarPanel parent={this.props.parent}>
        {this.props.info.title && (
          <SidebarBlockItem>
            <br />
            <strong>Title: </strong> {this.props.info.title}
          </SidebarBlockItem>
        )}
        {this.props.info.description && (
          <SidebarBlockItem>
            <strong>Description: </strong> {this.props.info.description}
          </SidebarBlockItem>
        )}
        {this.props.info.version && (
          <SidebarBlockItem>
            <strong>Version: </strong> {this.props.info.version}
          </SidebarBlockItem>
        )}
        {this.props.info.license.name && (
          <SidebarBlockItem>
            <strong>License: </strong> {this.props.info.license.name}
          </SidebarBlockItem>
        )}
      </SidebarPanel>
    );
  }
}
