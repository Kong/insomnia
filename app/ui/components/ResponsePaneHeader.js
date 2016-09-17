import React, {PropTypes, Component} from 'react';

import {ResponsePaneHeader} from './ResponsePaneHeader.elm';
import {RESPONSE_CODE_DESCRIPTIONS} from '../../lib/constants';


class ResponsePaneHeaderWrapper extends Component {
  componentWillReceiveProps (nextProps) {
    this._update(nextProps);
  }

  shouldComponentUpdate () {
    return false;
  }

  _update (props) {
    this.app.ports.replaceModel.send(this._getModel(props));
  }

  _initialize (node) {
    if (!node) {
      // Node is null if component is not mounted
      return;
    }

    // Make sure to remove existing Elm app if it's there
    node.innerHTML = '';

    this.app = ResponsePaneHeader.embed(node, this._getModel(this.props));
  }

  _getModel (props) {
    return {
      statusDescription: RESPONSE_CODE_DESCRIPTIONS[props.statusCode] || '',
      statusCode: props.statusCode,
      statusMessage: props.statusMessage,
      elapsedTime: props.elapsedTime,
      bytesRead: props.bytesRead
    };
  }

  render () {
    return (
      <div ref={node => this._initialize(node)}></div>
    );
  }
}

ResponsePaneHeader.propTypes = {
  statusCode: PropTypes.number.isRequired,
  statusMessage: PropTypes.string.isRequired,
  elapsedTime: PropTypes.number.isRequired,
  bytesRead: PropTypes.number.isRequired
};

export default ResponsePaneHeaderWrapper
