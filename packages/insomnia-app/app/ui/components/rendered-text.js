// @flow
import * as React from 'react';

type Props = {
  children: string,
  render: Function
};

type State = {
  renderedText: string,
  error: string
};

class RenderedText extends React.PureComponent<Props, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      renderedText: '',
      error: ''
    };
  }

  async _render() {
    const { render, children } = this.props;

    if (!children) {
      return;
    }

    try {
      const renderedText = await render(children);
      this.setState({ renderedText, error: '' });
    } catch (err) {
      this.setState({ error: err.message });
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
          style={{ fontSize: '0.9em', fontStyle: 'italic' }}>
          {this.state.error || 'Unknown Error'}
        </span>
      );
    } else {
      return this.state.renderedText || '';
    }
  }
}

export default RenderedText;
