// @flow
import * as React from 'react';
import SidebarPanel from './sidebar-panel';
import SidebarBlockItem from './sidebar-block-item';

type Props = {
  info: Object,
  parent: boolean,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('info');
  itemPath.push.apply(itemPath, items);
  console.log(itemPath);
  itemPath = [];
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarInfo extends React.Component<Props> {
  render() {
    const { title, description, version, license } = this.props.info;
    return (
      <SidebarPanel parent={this.props.parent}>
        {this.props.info.title && (
          <SidebarBlockItem>
            <br />
            <strong>Title:</strong>
            <span onClick={() => handleClick([title])}>{title}</span>
          </SidebarBlockItem>
        )}
        {description && (
          <SidebarBlockItem>
            <strong>Description:</strong>
            <span onClick={() => handleClick([description])}>{description}</span>
          </SidebarBlockItem>
        )}
        {version && (
          <SidebarBlockItem>
            <strong>Version:</strong>
            <span onClick={() => handleClick([version])}>{version}</span>
          </SidebarBlockItem>
        )}
        {license.name && (
          <SidebarBlockItem>
            <strong>License: </strong>
            <span onClick={() => handleClick([license.name])}>{license.name}</span>
          </SidebarBlockItem>
        )}
      </SidebarPanel>
    );
  }
}
