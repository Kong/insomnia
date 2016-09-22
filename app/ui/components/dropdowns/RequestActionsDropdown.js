import React, {Component, PropTypes} from 'react';
import PromptButton from '../base/PromptButton';
import Dropdown from '../base/Dropdown';
import DropdownHint from '../base/DropdownHint';
import GenerateCodeModal from '../modals/GenerateCodeModal';
import PromptModal from '../modals/PromptModal';
import * as db from 'backend/database';
import {getModal} from '../modals/index';


class RequestActionsDropdown extends Component {
  _promptUpdateName () {
    const {request} = this.props;

    getModal(PromptModal).show({
      headerName: 'Rename Request',
      defaultValue: request.name,
      hint: 'also rename requests by double clicking in the sidebar'
    }).then(name => {
      db.request.update(request, {name});
    })
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
            <button onClick={e => db.request.duplicate(request)}>
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
            <button onClick={e => getModal(GenerateCodeModal).show(request)}>
              <i className="fa fa-code"></i> Generate Code
            </button>
          </li>
          <li>
            <PromptButton onClick={e => db.request.remove(request)}
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
