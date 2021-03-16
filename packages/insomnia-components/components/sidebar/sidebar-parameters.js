// @flow
import * as React from 'react';
import Tooltip from '../tooltip';
import SidebarItem from './sidebar-item';
import SvgIcon, { IconEnum } from '../svg-icon';
import SidebarSection from './sidebar-section';
import StyledInvalidSection from './sidebar-invalid-section';

type Props = {
  parameters: Object,
  onClick: (section: string, ...args: any) => void,
};

// Implemented as a class component because of a caveat with render props
// https://reactjs.org/docs/render-props.html#be-careful-when-using-render-props-with-reactpurecomponent
export default class SidebarParameters extends React.Component<Props> {
  renderBody = (filter: string): null | React.Node => {
    const { parameters, onClick } = this.props;

    if (Object.prototype.toString.call(parameters) !== '[object Object]') {
      return <StyledInvalidSection name={'parameter'} />;
    }

    const filteredValues = Object.keys(parameters).filter(parameter =>
      parameter.toLowerCase().includes(filter.toLocaleLowerCase()),
    );

    if (!filteredValues.length) {
      return null;
    }

    return (
      <div>
        {filteredValues.map(parameter => (
          <React.Fragment key={parameter}>
            <SidebarItem>
              <div>
                <SvgIcon icon={IconEnum.indentation} />
              </div>
              <span onClick={() => onClick('components', 'parameters', parameter)}>
                <Tooltip message={parameters[parameter].description} position="right">
                  {parameter}
                </Tooltip>
              </span>
            </SidebarItem>
          </React.Fragment>
        ))}
      </div>
    );
  };

  render() {
    return <SidebarSection title="PARAMETERS" renderBody={this.renderBody} />;
  }
}
