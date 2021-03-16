// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';
import StyledInvalidSection from './sidebar-invalid-section';

type Props = {
  schemas: Object,
  onClick: (section: string, ...args: any) => void,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarSchemas extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const { schemas, onClick } = this.props;

    if (Object.prototype.toString.call(schemas) !== '[object Object]') {
      return <StyledInvalidSection name={'schema'} />;
    }

    const filteredValues = Object.keys(schemas).filter(schema =>
      schema.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(schema => (
          <SidebarItem key={schema}>
            <div>
              <SvgIcon icon={IconEnum.brackets} />
            </div>
            <span onClick={() => onClick('components', 'schemas', schema)}>{schema}</span>
          </SidebarItem>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SCHEMAS" renderBody={this.renderBody} />;
  }
}
