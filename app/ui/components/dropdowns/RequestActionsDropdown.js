import React, {Component, PropTypes} from 'react';
import PromptButton from '../base/PromptButton';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import GenerateCodeModal from '../modals/GenerateCodeModal';
import PromptModal from '../modals/PromptModal';
import * as models from '../../../models';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';


class RequestActionsDropdown extends Component {
  async _promptUpdateName () {
    const {request} = this.props;

    const name = await showModal(PromptModal, {
      headerName: 'Rename Request',
      defaultValue: request.name,
      hint: 'also rename requests by double clicking in the sidebar'
    });

    models.request.update(request, {name});
  }

  render () {
    const {request, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownItem onClick={e => {
          models.request.duplicate(request);
          trackEvent('Request', 'Duplicate', 'Action');
        }}>
          <i className="fa fa-copy"></i> Duplicate
          <DropdownHint char="D"></DropdownHint>
        </DropdownItem>
        <DropdownItem onClick={e => {
          this._promptUpdateName();
          trackEvent('Request', 'Rename', 'Action');
        }}>
          <i className="fa fa-edit"></i> Rename
        </DropdownItem>
        <DropdownItem onClick={e => {
          showModal(GenerateCodeModal, request);
          trackEvent('Request', 'Action', 'Generate Code');
        }}>
          <i className="fa fa-code"></i> Generate Code
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton}
                      onClick={e => {
                        models.request.remove(request);
                        trackEvent('Request', 'Delete', 'Action');
                      }}
                      addIcon={true}>
          <i className="fa fa-trash-o"></i> Delete
        </DropdownItem>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  request: PropTypes.object.isRequired
};

export default RequestActionsDropdown;
