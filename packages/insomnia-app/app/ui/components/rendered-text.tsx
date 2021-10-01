import React, { PureComponent } from 'react';

interface Props {
  children: string;
  render: (...args: any[]) => any;
}
interface State {
  renderedText: string;
  error: string;
}

export class RenderedText extends PureComponent<Props, State> {
  state: State = {
    renderedText: '',
    error: '',
  };

  async _render() {
    const { render, children } = this.props;

    if (!children) {
      return;
    }

    try {
      const renderedText = await render(children);
      this.setState({
        renderedText,
        error: '',
      });
    } catch (err) {
      this.setState({
        error: err.message,
      });
    }
  }

  componentDidMount() {
    this._render();
  }

  componentDidUpdate() {
    this._render();
  }

  render() {
    if (this.state.error) {
      return (
        <span
          className="font-error"
          style={{
            fontSize: '0.9em',
            fontStyle: 'italic',
          }}
        >
          {this.state.error || 'Unknown Error'}
        </span>
      );
    } else {
      return this.state.renderedText || '';
    }
  }
}
