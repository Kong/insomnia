import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  name: string;
  children?: ReactNode;
  onKeydown?: (...args: any[]) => any;
  onKeyup?: (...args: any[]) => any;
  disabled?: boolean;
  scoped?: boolean;
  captureEvent?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<Props> {
  static defaultProps: Pick<Props, 'captureEvent' | 'scoped'> = {
    captureEvent: false,
    scoped: true,
  };

  _handleKeydown(e: KeyboardEvent) {
    const { onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    if (this.props.scoped) {
      e.stopPropagation();
    }

    if (onKeydown) {
      onKeydown(e);
    }
  }

  _handleKeyup(e: KeyboardEvent) {
    const { onKeyup, disabled } = this.props;

    if (disabled) {
      return;
    }

    if (this.props.scoped) {
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
