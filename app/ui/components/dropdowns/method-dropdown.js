import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import * as constants from '../../../common/constants';
import {showModal} from '../modals/index';
import PromptModal from '../modals/prompt-modal';

const LOCALSTORAGE_KEY = 'insomnia.httpMethods';

@autobind
class MethodDropdown extends PureComponent {
  async _handleSetCustomMethod () {
    let recentMethods;
    try {
      const v = window.localStorage.getItem(LOCALSTORAGE_KEY);
      recentMethods = JSON.parse(v) || [];
    } catch (err) {
      recentMethods = [];
    }

    // Prompt user for the method
    const method = await showModal(PromptModal, {
      defaultValue: this.props.method,
      headerName: 'HTTP Method',
      submitName: 'Done',
      upperCase: true,
      selectText: true,
      hint: 'Common examples are LINK, UNLINK, FIND, PURGE',
      label: 'Name',
      placeholder: 'CUSTOM',
      hints: recentMethods
    });

    if (!method) {
      return;
    }

    // Save method as recent
    recentMethods = recentMethods.filter(m => m !== method);
    recentMethods.unshift(method);
    window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(recentMethods));

    // Invoke callback
    this.props.onChange(method);
  }

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
        <DropdownDivider/>
        <DropdownItem className="http-method-custom"
                      onClick={this._handleSetCustomMethod}
                      value={method}>
          Set Custom Method
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
  right: PropTypes.bool
};

export default MethodDropdown;
