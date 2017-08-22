// @flow
import React from 'react';

class RenderedText extends React.PureComponent {
  props: {
    component: string,
    children: string,
    render: Function,
    props?: Object
  };

  state: {
    renderedText: string
  };

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
    const {component, props} = this.props;
    return React.createElement(component, props || {}, this.state.renderedText);
  }
}

export default RenderedText;
