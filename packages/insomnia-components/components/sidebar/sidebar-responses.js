// @flow
import * as React from 'react';
import Tooltip from '../tooltip';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  responses: Object,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('response');
  itemPath.push.apply(itemPath, items);
  itemPath = [];
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarResponses extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = Object.keys(this.props.responses).filter(response =>
      response.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(response => (
          <SidebarItem key={response}>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <span onClick={() => handleClick([response])}>
              <Tooltip message={this.props.responses[response].description} position="right">
                {response}
              </Tooltip>
            </span>
          </SidebarItem>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="RESPONSES" renderBody={this.renderBody} />;
  }
}
