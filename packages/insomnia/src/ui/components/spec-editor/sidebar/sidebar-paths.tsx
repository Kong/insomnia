import React, { Component, Fragment, ReactNode } from 'react';

import { IconEnum, SvgIcon } from '../../svg-icon';
import { SidebarBadge } from './sidebar-badge';
import { SidebarInvalidSection } from './sidebar-invalid-section';
import { SidebarItem } from './sidebar-item';
import { SidebarSection } from './sidebar-section';

export type SidebarPathsType = Record<string, any> | string;

export interface SidebarPathsProps {
  paths: SidebarPathsType;
  onClick: (section: string, ...args: any) => void;
}

const isNotXDashKey = (key: string) => key.indexOf('x-') !== 0;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export class SidebarPaths extends Component<SidebarPathsProps> {
  renderBody = (filter: string): null | ReactNode => {
    const { paths, onClick } = this.props;
    let pathItems = {};

    if (typeof paths !== 'string') {
      pathItems = Object.entries(paths || {});
    }

    if (Object.prototype.toString.call(pathItems) !== '[object Array]') {
      return <SidebarInvalidSection name={'path'} />;
    }

    // @ts-expect-error TSCONVERSION
    const filteredValues = pathItems.filter(pathDetail =>
      pathDetail[0].toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {// @ts-expect-error TSCONVERSION
          filteredValues.map(([route, routeBody]) => (
            <Fragment key={route}>
              <SidebarItem gridLayout onClick={() => onClick('paths', route)}>
                <div>
                  <SvgIcon icon={IconEnum.indentation} />
                </div>
                <span>{route}</span>
              </SidebarItem>
              <SidebarItem>
                {Object.keys(routeBody)
                  .filter(isNotXDashKey)
                  .map(method => (
                    <SidebarBadge
                      key={method}
                      method={method}
                      onClick={() => onClick('paths', route, method)}
                    />
                  ))}
              </SidebarItem>
            </Fragment>
          ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="PATHS" renderBody={this.renderBody} />;
  }
}
