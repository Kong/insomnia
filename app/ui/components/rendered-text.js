// @flow
import * as React from 'react';

type Props = {
  children: string,
  render: Function
};

type State = {
  renderedText: string
};

class RenderedText extends React.PureComponent<Props, State> {
  constructor (props: any) {
    super(props);
    this.state = {
      renderedText: ''
    };
  }

  async _render () {
    const {render, children} = this.props;
    const renderedText = await render(children);
    this.setState({renderedText});
  }

  componentDidMount () {
    this._render();
  }

  componentDidUpdate () {
    this._render();
  }

  render () {
    return this.state.renderedText;
  }
}

export default RenderedText;
