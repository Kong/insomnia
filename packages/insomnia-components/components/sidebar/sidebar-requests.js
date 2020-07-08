// @flow
import * as React from 'react';
import Tooltip from '../tooltip';
import SidebarItem from './sidebar-item';
import SidebarBlockItem from './sidebar-block-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  requests: Object,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('request');
  itemPath.push.apply(itemPath, items);
  console.log(itemPath);
  itemPath = [];
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarRequests extends React.Component<Props> {
  renderBody = (filter: string) => (
    <div>
      {Object.keys(this.props.requests).map((requestName, value) => (
        <React.Fragment key={requestName}>
          {requestName.toLowerCase().includes(filter) && (
            <React.Fragment>
              <SidebarItem>
                <div></div>
                <div>
                  <SvgIcon icon={IconEnum.folderOpen} />
                </div>
                <span onClick={() => handleClick([requestName])}>
                  <Tooltip message={this.props.requests[requestName].description} position="right">
                    {requestName}
                  </Tooltip>
                </span>
              </SidebarItem>
              {Object.keys(this.props.requests[requestName].content).map(requestFormat => (
                <React.Fragment key={requestFormat}>
                  <SidebarItem>
                    <div></div>
                    <div>
                      &nbsp;
                      <SvgIcon icon={IconEnum.indentation} />
                    </div>
                    <span onClick={() => handleClick([requestFormat])}>{requestFormat}</span>
                  </SidebarItem>
                  <SidebarBlockItem>
                    {Object.keys(
                      this.props.requests[requestName].content[requestFormat].examples,
                    ).map(requestExample => (
                      <div
                        onClick={() => handleClick([requestExample])}
                        className="method-post"
                        key={requestExample}>
                        {requestExample}
                      </div>
                    ))}
                  </SidebarBlockItem>
                </React.Fragment>
              ))}
            </React.Fragment>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  render() {
    return <SidebarSection title="REQUESTS" renderBody={this.renderBody} />;
  }
}
