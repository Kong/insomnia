import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../base/Dropdown'
import * as RequestActions from '../../actions/requests'

class RequestActionsDropdown extends Component {
  render () {
    const {actions, request, buttonClassName, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <button className={buttonClassName}>
          <i className="fa fa-gear"></i>
        </button>
        <ul>
          <li><button>Duplicate</button></li>
          <li><button>Rename</button></li>
          <li><button>Export</button></li>
          <li><button onClick={e => actions.deleteRequest(request.id)}>Delete</button></li>
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
  buttonClassName: PropTypes.string
};

function mapStateToProps (state) {
  return {actions: state.actions};
}

function mapDispatchToProps (dispatch) {
  return {actions: bindActionCreators(RequestActions, dispatch)}
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestActionsDropdown);
