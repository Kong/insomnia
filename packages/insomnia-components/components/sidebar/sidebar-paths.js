// @flow
import * as React from 'react';
import styled from 'styled-components';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  paths: Array<any>,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('path');
  itemPath.push.apply(itemPath, items);
  itemPath = [];
};

const StyledMethods: React.ComponentType<{}> = styled.span`
  padding-left: var(--padding-lg);
`;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarPaths extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = this.props.paths.filter(pathDetail =>
      pathDetail[0].toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(([route, method]) => (
          <React.Fragment key={route}>
            <SidebarItem gridLayout>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => handleClick([route])}>{route}</span>
            </SidebarItem>
            <SidebarItem>
              <StyledMethods>
                {Object.keys((method: any)).map(method => (
                  <span
                    key={method}
                    className={`method-${method}`}
                    onClick={() => handleClick([route, method])}>
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
