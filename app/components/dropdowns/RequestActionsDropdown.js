import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../base/Dropdown'
import * as RequestActions from '../../actions/requests'

class RequestActionsDropdown extends Component {
  render () {
    const {actions, request, requestGroup, ...other} = this.props;
    const requestGroupId = requestGroup ? requestGroup.id : null;

    return (
      <Dropdown {...other}>
        <button>
          <i className="fa fa-gear"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => actions.duplicateRequest(request, requestGroupId)}>
              <i className="fa fa-copy"></i> Duplicate
            </button>
          </li>
          <li>
            <button onClick={e => actions.showRequestUpdateNamePrompt(request)}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button>
              <i className="fa fa-share-square-o"></i> Export
            </button>
          </li>
          <li>
            <button onClick={e => actions.deleteRequest(request.id)}>
              <i className="fa fa-trash-o"></i> Delete
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  request: PropTypes.object.isRequired,
  actions: PropTypes.shape({
    deleteRequest: PropTypes.func.isRequired,
    showRequestUpdateNamePrompt: PropTypes.func.isRequired,
    duplicateRequest: PropTypes.func.isRequired
  }),
  requestGroup: PropTypes.object
};

function mapStateToProps (state) {
  return {
    actions: state.actions
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: bindActionCreators(RequestActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestActionsDropdown);
