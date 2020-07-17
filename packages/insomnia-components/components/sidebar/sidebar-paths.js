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
  console.log(itemPath);
  itemPath = [];
};

const StyledMethods: React.ComponentType<{}> = styled.span`
  padding-left: var(--padding-lg);
`;

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarPaths extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    // console.log(this.props.paths);
    // const [route, method] = this.props.paths;
    const filteredValues = this.props.paths.filter(xpath =>
      xpath[0].toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(path => (
          <React.Fragment key={path[0]}>
            {path[0].includes(filter.toLocaleLowerCase()) && (
              <React.Fragment>
                <SidebarItem gridLayout>
                  <div>
                    <SvgIcon icon={IconEnum.indentation} />
                  </div>
                  <span onClick={() => handleClick([path[0]])}>{path[0]}</span>
                </SidebarItem>
                <SidebarItem>
                  <StyledMethods>
                    {Object.keys((path[1]: any)).map(method => (
                      <span
                        key={method}
                        className={`method-${method}`}
                        onClick={() => handleClick([path[0], method])}>
                        {method}
                      </span>
                    ))}
                  </StyledMethods>
                </SidebarItem>
              </React.Fragment>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="PATHS" renderBody={this.renderBody} />;
  }
}
