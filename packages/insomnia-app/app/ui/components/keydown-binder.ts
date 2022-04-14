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
  attachToDocumentBody?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<RequireAtLeastOne<Props, 'onKeydown' | 'onKeyup'>> {
  static defaultProps: Pick<Props, 'attachToDocumentBody' | 'detectCapturingPhase'> = {
    attachToDocumentBody: false,
    detectCapturingPhase: false,
  };

  _handleKeydown(e: KeyboardEvent) {
    const { onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    if (!this.props.attachToDocumentBody) {
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

    if (!this.props.attachToDocumentBody) {
      e.stopPropagation();
    }

    if (onKeyup) {
      onKeyup(e);
    }
  }

  componentDidMount() {
    if (!this.props.attachToDocumentBody) {
      const el = ReactDOM.findDOMNode(this);
      el?.addEventListener('keydown', this._handleKeydown, { capture: this.props.detectCapturingPhase });
      el?.addEventListener('keyup', this._handleKeyup);
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown, { capture: this.props.detectCapturingPhase });
      document.body && document.body.addEventListener('keyup', this._handleKeyup, { capture: this.props.detectCapturingPhase });
    }
  }

  componentWillUnmount() {
    if (!this.props.attachToDocumentBody) {
      const el = ReactDOM.findDOMNode(this);
      el?.removeEventListener('keydown', this._handleKeydown, { capture: this.props.detectCapturingPhase });
      el?.removeEventListener('keyup', this._handleKeyup, { capture: this.props.detectCapturingPhase });
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown, { capture: this.props.detectCapturingPhase });
      document.body && document.body.removeEventListener('keyup', this._handleKeyup, { capture: this.props.detectCapturingPhase });
    }
  }

  render() {
    return this.props.children ?? null;
  }
}
