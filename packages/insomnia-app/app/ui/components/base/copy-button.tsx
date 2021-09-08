import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { clipboard } from 'electron';
import { Button, ButtonProps } from 'insomnia-components';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props extends ButtonProps {
  content: string | Function;
  children?: ReactNode;
  title?: string;
  confirmMessage?: string;
}

interface State {
  showConfirmation: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class CopyButton extends PureComponent<Props, State> {
  state: State = {
    showConfirmation: false,
  };

  _triggerTimeout: NodeJS.Timeout | null = null;

  async _handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const content =
      typeof this.props.content === 'string' ? this.props.content : await this.props.content();

    if (content) {
      clipboard.writeText(content);
    }

    this.setState({
      showConfirmation: true,
    });
    this._triggerTimeout = setTimeout(() => {
      this.setState({
        showConfirmation: false,
      });
    }, 2000);
  }

  componentWillUnmount() {
    if (this._triggerTimeout === null) {
      return;
    }
    clearTimeout(this._triggerTimeout);
  }

  render() {
    const {
      content,
      children,
      title,
      confirmMessage,
      ...other
    } = this.props;
    const { showConfirmation } = this.state;
    const confirm = typeof confirmMessage === 'string' ? confirmMessage : 'Copied';
    return (
      <Button {...other} title={title} onClick={this._handleClick}>
        {showConfirmation ? (
          <span>
            {confirm} <i className="fa fa-check-circle-o" />
          </span>
        ) : (
          children || 'Copy to Clipboard'
        )}
      </Button>
    );
  }
}
