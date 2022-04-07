import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG, isMac } from '../../common/constants';

interface Props {
  children?: ReactNode;
  onKeydown?: (...args: any[]) => any;
  onKeyup?: (...args: any[]) => any;
  disabled?: boolean;
  scoped?: boolean;
  stopMetaPropagation?: boolean;
  captureEvent?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<Props> {
  static defaultProps: Pick<Props, 'captureEvent'> = {
    captureEvent: true,
  };

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
      el?.addEventListener('keydown', this._handleKeydown, { capture: this.props.captureEvent });
      el?.addEventListener('keyup', this._handleKeyup, { capture: this.props.captureEvent });
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown, { capture: this.props.captureEvent });
      document.body && document.body.addEventListener('keyup', this._handleKeyup, { capture: this.props.captureEvent });
    }
  }

  componentWillUnmount() {
    if (this.props.scoped) {
      const el = ReactDOM.findDOMNode(this);
      el?.removeEventListener('keydown', this._handleKeydown, { capture: this.props.captureEvent });
      el?.removeEventListener('keyup', this._handleKeyup, { capture: this.props.captureEvent });
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown, { capture: this.props.captureEvent });
      document.body && document.body.removeEventListener('keyup', this._handleKeyup, { capture: this.props.captureEvent });
    }
  }

  render() {
    return this.props.children ?? null;
  }
}
