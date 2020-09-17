// @flow
import * as React from 'react';
import styled from 'styled-components';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';
import StyledInvalidSection from './sidebar-invalid-section';

type Props = {
  paths: Object,
  onClick: (section: string, ...args: any) => void,
};

const StyledMethods: React.ComponentType<{}> = styled.span`
  padding-left: var(--padding-lg);
`;

const isNotXDashKey = key => key.indexOf('x-') !== 0;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarPaths extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const { paths, onClick } = this.props;
    let pathItems = {};
    if (typeof paths !== 'string') {
      pathItems = Object.entries(paths || {});
    }
    if (Object.prototype.toString.call(pathItems) !== '[object Array]') {
      return <StyledInvalidSection name={'path'} />;
    }
    const filteredValues = pathItems.filter(pathDetail =>
      pathDetail[0].toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(([route, routeBody]) => (
          <React.Fragment key={route}>
            <SidebarItem gridLayout onClick={() => onClick('paths', route)}>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span>{route}</span>
            </SidebarItem>
            <SidebarItem>
              <StyledMethods>
                {Object.keys((routeBody: any))
                  .filter(isNotXDashKey)
                  .map(method => (
                    <span
                      key={method}
                      className={`method-${method}`}
                      onClick={() => onClick('paths', route, method)}>
                      {method}
                    </span>
                  ))}
              </StyledMethods>
            </SidebarItem>
          </React.Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="PATHS" renderBody={this.renderBody} />;
  }
}
