// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  security: Object,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('security');
  itemPath.push.apply(itemPath, items);
  itemPath = [];
};
// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarSecurity extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = Object.keys(this.props.security).filter(scheme =>
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
              <span onClick={() => handleClick([scheme])}>{scheme}</span>
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
