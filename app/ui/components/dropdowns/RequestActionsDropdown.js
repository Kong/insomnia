import React, {Component, PropTypes} from 'react';
import PromptButton from '../base/PromptButton';
import Dropdown from '../base/Dropdown';
import DropdownHint from '../base/DropdownHint';
import GenerateCodeModal from '../modals/GenerateCodeModal';
import PromptModal from '../modals/PromptModal';
import * as models from '../../../backend/models';
import {showModal} from '../modals/index';


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
        <button>
          <i className="fa fa-caret-down"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => models.request.duplicate(request)}>
              <i className="fa fa-copy"></i> Duplicate
              <DropdownHint char="D"></DropdownHint>
            </button>
          </li>
          <li>
            <button onClick={e => this._promptUpdateName()}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button onClick={e => showModal(GenerateCodeModal, request)}>
              <i className="fa fa-code"></i> Generate Code
            </button>
          </li>
          <li>
            <PromptButton onClick={e => models.request.remove(request)}
                          addIcon={true}>
              <i className="fa fa-trash-o"></i> Delete
            </PromptButton>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  request: PropTypes.object.isRequired
};

export default RequestActionsDropdown;
