import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../base/Dropdown'
import * as RequestActions from '../../actions/requests'
import * as GlobalActions from '../../actions/global'

class RequestActionsDropdown extends Component {
  render () {
    const {actions, request, requestGroup, buttonClassName, ...other} = this.props;
    const requestGroupId = requestGroup ? requestGroup.id : null;

    return (
      <Dropdown {...other}>
        <button className={buttonClassName}>
          <i className="fa fa-gear"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => actions.duplicateRequest(request, requestGroupId)}>
              <i className="fa fa-copy"></i> Duplicate
            </button>
          </li>
          <li>
            <button onClick={e => actions.showRequestUpdateNamePrompt(request.id)}>
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
    deleteRequest: PropTypes.func.isRequired
  }),
  requestGroup: PropTypes.object,
  buttonClassName: PropTypes.string
};

function mapStateToProps (state) {
  return {actions: state.actions};
}

function mapDispatchToProps (dispatch) {
  return {
    actions: Object.assign(
      {},
      bindActionCreators(RequestActions, dispatch),
      bindActionCreators(GlobalActions, dispatch)
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestActionsDropdown);
