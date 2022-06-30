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
  capture?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<Props> {
  _handleKeydown(event: KeyboardEvent) {
    const { stopMetaPropagation, onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? event.metaKey : event.ctrlKey;

    if (stopMetaPropagation && isMeta) {
      event.stopPropagation();
    }

    if (onKeydown) {
      onKeydown(event);
    }
  }

  _handleKeyup(event: KeyboardEvent) {
    const { stopMetaPropagation, onKeyup, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? event.metaKey : event.ctrlKey;

    if (stopMetaPropagation && isMeta) {
      event.stopPropagation();
    }

    if (onKeyup) {
      onKeyup(event);
    }
  }

  componentDidMount() {
    if (this.props.scoped) {
      // TODO: unsound casting
      const el = ReactDOM.findDOMNode(this) as HTMLElement | null;
      // @TODO - Inverse the capture flag
      el?.addEventListener('keydown', this._handleKeydown, { capture: this.props.capture ?? true });
      el?.addEventListener('keyup', this._handleKeyup, { capture: this.props.capture ?? true });
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown, { capture: this.props.capture ?? true });
      document.body && document.body.addEventListener('keyup', this._handleKeyup, { capture: this.props.capture ?? true });
    }
  }

  componentWillUnmount() {
    if (this.props.scoped) {
      // TODO: unsound casting
      const el = ReactDOM.findDOMNode(this) as HTMLElement | null;
      el?.removeEventListener('keydown', this._handleKeydown, { capture: this.props.capture ?? true });
      el?.removeEventListener('keyup', this._handleKeyup, { capture: this.props.capture ?? true });
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown, { capture: this.props.capture ?? true });
      document.body && document.body.removeEventListener('keyup', this._handleKeyup, { capture: this.props.capture ?? true });
    }
  }

  render() {
    return this.props.children ?? null;
  }
}
