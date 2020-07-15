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
  console.log(itemPath);
  itemPath = [];
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarResponses extends React.Component<Props> {
  renderBody = (filter: string) => (
    <div>
      {Object.keys(this.props.responses).map(response => (
        <React.Fragment key={response}>
          {response.toLowerCase().includes(filter.toLocaleLowerCase()) && (
            <SidebarItem>
              <div></div>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => handleClick([response])}>
                <Tooltip message={this.props.responses[response].description} position="right">
                  {response}
                </Tooltip>
              </span>
            </SidebarItem>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  render() {
    return <SidebarSection title="RESPONSES" renderBody={this.renderBody} />;
  }
}
