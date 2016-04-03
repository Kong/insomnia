import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../base/Dropdown'
import * as RequestActions from '../../actions/requests'

class RequestActionsDropdown extends Component {
  render () {
    const {actions, request, ...other} = this.props;

    return (
      <Dropdown right={this.props.right || false} {...other}>
        <button className="pane__header__content">
          <i className="fa fa-angle-down pull-right"></i>
        </button>
        <ul className="bg-super-light">
          <li><button onClick={actions.deleteRequest.bind(null, request.id)}>Delete</button></li>
        </ul>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  request: PropTypes.object.isRequired,
  actions: PropTypes.shape({
    deleteRequest: PropTypes.func.isRequired
  })
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
