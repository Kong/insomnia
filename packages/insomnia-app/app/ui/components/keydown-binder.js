// @flow
import * as React from 'react';
import ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import { isMac } from '../../common/constants';

type Props = {
  onKeydown: Function,
  children?: React.Node,
  disabled?: boolean,
  scoped?: boolean,
  stopMetaPropagation?: boolean
};

@autobind
class KeydownBinder extends React.PureComponent<Props> {
  _handleKeydown(e: KeyboardEvent) {
    const { stopMetaPropagation, onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? e.metaKey : e.ctrlKey;
    if (stopMetaPropagation && isMeta) {
      e.stopPropagation();
    }

    onKeydown(e);
  }

  componentDidMount() {
    if (this.props.scoped) {
      const el = ReactDOM.findDOMNode(this);
      el && el.addEventListener('keydown', this._handleKeydown);
    } else {
      document.body &&
        document.body.addEventListener('keydown', this._handleKeydown);
    }
  }

  componentWillUnmount() {
    if (this.props.scoped) {
      const el = ReactDOM.findDOMNode(this);
      el && el.removeEventListener('keydown', this._handleKeydown);
    } else {
      document.body &&
        document.body.removeEventListener('keydown', this._handleKeydown);
    }
  }

  render() {
    return this.props.children;
  }
}

export default KeydownBinder;
