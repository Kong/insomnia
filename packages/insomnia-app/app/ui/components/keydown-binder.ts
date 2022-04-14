import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { RequireAtLeastOne } from 'type-fest';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  onKeydown?: (...args: any[]) => any;
  onKeyup?: (...args: any[]) => any;
  children: ReactNode;
  disabled?: boolean;
  scoped?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<RequireAtLeastOne<Props, 'onKeydown' | 'onKeyup'>> {
  static defaultProps: Pick<Props, 'scoped'> = {
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
      el?.addEventListener('keydown', this._handleKeydown);
      el?.addEventListener('keyup', this._handleKeyup);
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown);
      document.body && document.body.addEventListener('keyup', this._handleKeyup);
    }
  }

  componentWillUnmount() {
    if (this.props.scoped) {
      const el = ReactDOM.findDOMNode(this);
      el?.removeEventListener('keydown', this._handleKeydown);
      el?.removeEventListener('keyup', this._handleKeyup);
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown);
      document.body && document.body.removeEventListener('keyup', this._handleKeyup);
    }
  }

  render() {
    return this.props.children ?? null;
  }
}
