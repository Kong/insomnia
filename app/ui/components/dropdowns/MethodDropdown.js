import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import * as constants from '../../../common/constants';
import {showModal} from '../modals/index';
import PromptModal from '../modals/PromptModal';

@autobind
class MethodDropdown extends PureComponent {
  async _handleSetCustomMethod () {
    const method = await showModal(PromptModal, {
      defaultValue: this.props.method,
      headerName: 'Custom HTTP Method',
      submitName: 'Done',
      hint: 'Common examples are LINK, UNLINK, FIND, PURGE  ',
      label: 'Method Name',
      placeholder: 'CUSTOM',
      hints: [
        'FIND',
        'PURGE',
        'DELETEHARD',
        'LINK',
        'UNLINK'
      ]
    });

    if (method) {
      this.props.onChange(method.toUpperCase());
    }
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
        <DropdownItem className={`http-method-custom`}
                      onClick={this._handleSetCustomMethod}
                      value={method}>
          Custom Method
        </DropdownItem>
      </Dropdown>
    );
  }
}

MethodDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,
  method: PropTypes.string.isRequired
};

export default MethodDropdown;
