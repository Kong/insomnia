// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';

type Props = {
  schemas: Object,
};

let itemPath = [];
const handleClick = items => {
  itemPath.push('schema');
  itemPath.push.apply(itemPath, items);
  console.log(itemPath);
  itemPath = [];
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarSchemas extends React.Component<Props> {
  renderBody = (filter: string) => (
    <div>
      {Object.keys(this.props.schemas).map(schema => (
        <React.Fragment key={schema}>
          {schema.toLowerCase().includes(filter.toLocaleLowerCase()) && (
            <SidebarItem>
              <div></div>
              <div>
                <SvgIcon icon={IconEnum.brackets} />
              </div>
              <span onClick={() => handleClick([schema])}>{schema}</span>
            </SidebarItem>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  render() {
    return <SidebarSection title="SCHEMAS" renderBody={this.renderBody} />;
  }
}
