// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';
import StyledInvalidSection from './sidebar-invalid-section';

type Props = {
  security: Object,
  onClick: (section: string, ...args: any) => void,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarSecurity extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const { security, onClick } = this.props;

    if (Object.prototype.toString.call(security) !== '[object Object]') {
      return <StyledInvalidSection name={'security'} />;
    }

    const filteredValues = Object.keys(security).filter(scheme =>
      scheme.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(scheme => (
          <React.Fragment key={scheme}>
            <SidebarItem>
              <div>
                <SvgIcon icon={IconEnum.key} />
              </div>
              <span onClick={() => onClick('components', 'securitySchemes', scheme)}>{scheme}</span>
            </SidebarItem>
          </React.Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SECURITY" renderBody={this.renderBody} />;
  }
}
