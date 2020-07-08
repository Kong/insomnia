// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SidebarBlockItem from './sidebar-block-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  paths: Array<any>,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarPaths extends React.Component<Props> {
  renderBody = (filter: string) => (
    <div>
      {this.props.paths.map(path => (
        <React.Fragment key={path[0]}>
          {path[0].includes(filter) && (
            <React.Fragment>
              <SidebarItem>
                <div></div>
                <div>
                  <SvgIcon icon={IconEnum.indentation} />
                </div>
                <span>{path[0]}</span>
              </SidebarItem>
              <SidebarBlockItem>
                <span></span>&nbsp;&nbsp;
                {Object.keys((path[1]: any)).map(method => (
                  <span key={method} className={`method-${method}`}>
                    {method}
                  </span>
                ))}
              </SidebarBlockItem>
            </React.Fragment>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  render() {
    return <SidebarSection title="PATHS" renderBody={this.renderBody} />;
  }
}
