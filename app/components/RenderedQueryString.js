import React, {PropTypes, Component} from 'react';
import {getRenderedRequest} from '../lib/render';
import * as querystring from '../lib/querystring';


class RenderedQueryString extends Component {
  constructor (props) {
    super(props);
    this.state = {
      string: ''
    }
  }

  _update (props) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      getRenderedRequest(props.request).then(({parameters}) => {
        const qs = querystring.buildFromParams(parameters);
        this.setState({string: qs});
      });
    }, 500);
  }

  componentDidMount () {
    this._update(this.props);
  }

  componentWillReceiveProps (nextProps) {
    this._update(nextProps);
  }

  render () {
    if (this.state.string) {
      return <span>{this.state.string}</span>
    } else {
      return <span className="super-faint">add some parameters below</span>
    }
  }
}


RenderedQueryString.propTypes = {
  request: PropTypes.object.isRequired
};

export default RenderedQueryString;
