import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { isMac, AUTOBIND_CFG } from '../../common/constants';

interface Props {
  children: ReactNode;
  onKeydown?: (...args: any[]) => any;
  onKeyup?: (...args: any[]) => any;
  disabled?: boolean;
  scoped?: boolean;
  stopMetaPropagation?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class KeydownBinder extends PureComponent<Props> {
  _handleKeydown(e: KeyboardEvent) {
    const { stopMetaPropagation, onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? e.metaKey : e.ctrlKey;

    if (stopMetaPropagation && isMeta) {
      e.stopPropagation();
    }

    if (onKeydown) {
      onKeydown(e);
    }
  }

  _handleKeyup(e: KeyboardEvent) {
    const { stopMetaPropagation, onKeyup, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? e.metaKey : e.ctrlKey;

    if (stopMetaPropagation && isMeta) {
      e.stopPropagation();
    }

    if (onKeyup) {
      onKeyup(e);
    }
  }

  componentDidMount() {
    if (this.props.scoped) {
      const el = ReactDOM.findDOMNode(this);
      el && el.addEventListener('keydown', this._handleKeydown);
      el && el.addEventListener('keyup', this._handleKeyup);
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown);
      document.body && document.body.addEventListener('keyup', this._handleKeyup);
    }
  }

  componentWillUnmount() {
    if (this.props.scoped) {
      const el = ReactDOM.findDOMNode(this);
      el && el.removeEventListener('keydown', this._handleKeydown);
      el && el.removeEventListener('keyup', this._handleKeyup);
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown);
      document.body && document.body.removeEventListener('keyup', this._handleKeyup);
    }
  }

  render() {
    return this.props.children;
  }
}

export default KeydownBinder;
