import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';
import * as constants from '../../../common/constants';

@autobind
class StatusCodeDropdown extends PureComponent {
  _setDropdownRef(n) {
    this._dropdown = n;
  }

  _handleChange(statusCode) {
    this.props.onChange(statusCode);
  }

  toggle() {
    this._dropdown && this._dropdown.toggle(true);
  }

  render() {
    const {
      statuscode,
      right,
      onChange, // eslint-disable-line no-unused-vars
      ...extraProps
    } = this.props;
    return (
      <Dropdown ref={this._setDropdownRef} className="method-dropdown" right={right}>
        <DropdownButton type="button" {...extraProps}>
          {statuscode} <i className="fa fa-caret-down" />
        </DropdownButton>
        {Object.keys(constants.RESPONSE_CODE_REASONS).map(code => (
          <DropdownItem
            key={code}
            className={`http-status-${code}`}
            onClick={this._handleChange}
            value={code}>
            {code}
          </DropdownItem>
        ))}
      </Dropdown>
    );
  }
}

export default StatusCodeDropdown;
