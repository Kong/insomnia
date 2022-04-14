import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { RequireAtLeastOne } from 'type-fest';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  detectCapturingPhase?: boolean;
  onKeydown?: (...args: any[]) => any;
  onKeyup?: (...args: any[]) => any;
  children: ReactNode;
  disabled?: boolean;

  /** When set to `true` the key event is added to `document.body`.
   * This could be useful in situations where you have to execute the keyboard event handler globally.
   *
   * When set to `false` (or unset) it attached the event listener to the child component directly.
   */
  attachToDocumentBody?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<RequireAtLeastOne<Props, 'onKeydown' | 'onKeyup'>> {
  _handleKeydown(e: KeyboardEvent) {
    const { attachToDocumentBody, onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    if (!attachToDocumentBody) {
      e.stopPropagation();
    }

    if (onKeydown) {
      onKeydown(e);
    }
  }

  _handleKeyup(e: KeyboardEvent) {
    const { attachToDocumentBody, onKeyup, disabled } = this.props;

    if (disabled) {
      return;
    }

    if (!attachToDocumentBody) {
      e.stopPropagation();
    }

    if (onKeyup) {
      onKeyup(e);
    }
  }

  componentDidMount() {
    const { detectCapturingPhase, attachToDocumentBody } = this.props;
    const options = { capture: detectCapturingPhase };
    if (!attachToDocumentBody) {
      const el = ReactDOM.findDOMNode(this);
      el?.addEventListener('keydown', this._handleKeydown, options);
      el?.addEventListener('keyup', this._handleKeyup, options);
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown, options);
      document.body && document.body.addEventListener('keyup', this._handleKeyup, options);
    }
  }

  componentWillUnmount() {
    const { detectCapturingPhase, attachToDocumentBody } = this.props;
    const options = { capture: detectCapturingPhase };
    if (!attachToDocumentBody) {
      const el = ReactDOM.findDOMNode(this);
      el?.removeEventListener('keydown', this._handleKeydown, options);
      el?.removeEventListener('keyup', this._handleKeyup, options);
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown, options);
      document.body && document.body.removeEventListener('keyup', this._handleKeyup, options);
    }
  }

  render() {
    return this.props.children ?? null;
  }
}
