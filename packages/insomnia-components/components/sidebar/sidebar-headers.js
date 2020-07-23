// @flow
import * as React from 'react';
import Tooltip from '../tooltip';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  headers: Object,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('header');
  itemPath.push.apply(itemPath, items);
  itemPath = [];
};
// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarHeaders extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = Object.keys(this.props.headers).filter(header =>
      header.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(header => (
          <React.Fragment key={header}>
            <SidebarItem>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => handleClick([header])}>
                <Tooltip message={this.props.headers[header].description} position="right">
                  {header}
                </Tooltip>
              </span>
            </SidebarItem>
          </React.Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="HEADERS" renderBody={this.renderBody} />;
  }
}
