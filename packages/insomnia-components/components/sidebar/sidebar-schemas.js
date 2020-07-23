// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  schemas: Object,
  onClick: (section: string, path: Array<mixed>) => void,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarSchemas extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const filteredValues = Object.keys(this.props.schemas).filter(schema =>
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
            <span onClick={() => this.props.onClick('components', ['schemas', schema])}>
              {schema}
            </span>
          </SidebarItem>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="SCHEMAS" renderBody={this.renderBody} />;
  }
}
