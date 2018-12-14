import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import * as constants from '../../../common/constants';
import { showPrompt } from '../modals/index';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';

@autobind
class MethodDropdown extends PureComponent {
  _setDropdownRef(n) {
    this._dropdown = n;
  }

  _handleSetCustomMethod() {
    let recentMethods;
    try {
      const v = window.localStorage.getItem(LOCALSTORAGE_KEY);
      recentMethods = JSON.parse(v) || [];
    } catch (err) {
      recentMethods = [];
    }

    // Prompt user for the method
    showPrompt({
      defaultValue: this.props.method,
      title: 'HTTP Method',
      submitName: 'Done',
      upperCase: true,
      selectText: true,
      hint: 'Common examples are LINK, UNLINK, FIND, PURGE',
      label: 'Name',
      placeholder: 'CUSTOM',
      hints: recentMethods,
      onDeleteHint: method => {
        recentMethods = recentMethods.filter(m => m !== method);
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recentMethods));
      },
      onComplete: method => {
        // Don't add empty methods
        if (!method) {
          return;
        }

        // Don't add base methods
        if (constants.HTTP_METHODS.includes(method)) {
          return;
        }

        // Save method as recent
        recentMethods = recentMethods.filter(m => m !== method);
        recentMethods.unshift(method);
        window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recentMethods));

        // Invoke callback
        this.props.onChange(method);
      },
    });
  }

  _handleChange(method) {
    this.props.onChange(method);
  }

  toggle() {
    this._dropdown && this._dropdown.toggle(true);
  }

  render() {
    const {
      method,
      right,
      onChange, // eslint-disable-line no-unused-vars
      ...extraProps
    } = this.props;
    return (
      <Dropdown ref={this._setDropdownRef} className="method-dropdown" right={right}>
        <DropdownButton type="button" {...extraProps}>
          {method} <i className="fa fa-caret-down" />
        </DropdownButton>
        {constants.HTTP_METHODS.map(method => (
          <DropdownItem
            key={method}
            className={`http-method-${method}`}
            onClick={this._handleChange}
            value={method}>
            {method}
          </DropdownItem>
        ))}
        <DropdownDivider />
        <DropdownItem
          className="http-method-custom"
          onClick={this._handleSetCustomMethod}
          value={method}>
          Custom Method
        </DropdownItem>
      </Dropdown>
    );
  }
}

MethodDropdown.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  method: PropTypes.string.isRequired,

  // Optional
  right: PropTypes.bool,
};

export default MethodDropdown;
