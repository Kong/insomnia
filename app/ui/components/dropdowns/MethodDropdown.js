import React, {PropTypes, PureComponent} from 'react';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import * as constants from '../../../common/constants';

class MethodDropdown extends PureComponent {
  render () {
    const {method, onChange, right, ...extraProps} = this.props;
    return (
      <Dropdown className="method-dropdown" right={right}>
        <DropdownButton type="button" {...extraProps}>
          {method} <i className="fa fa-caret-down"/>
        </DropdownButton>
        {constants.HTTP_METHODS.map(method => (
          <DropdownItem key={method}
                        className={`http-method-${method}`}
                        onClick={onChange}
                        value={method}>
            {method}
          </DropdownItem>
        ))}
      </Dropdown>
    )
  }
}

MethodDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,
  method: PropTypes.string.isRequired,
};

export default MethodDropdown;
