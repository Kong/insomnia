import React, { type FC, PureComponent } from 'react';

import type { HandleRender } from '../../templating/types';
import { useNunjucks } from '../context/nunjucks/use-nunjucks';

interface Props {
  children: string;
  render: HandleRender;
}
interface State {
  renderedText: string;
  error: string;
}

class RenderedTextInternal extends PureComponent<Props, State> {
  state: State = {
    renderedText: '',
    error: '',
  };

  async _render() {
    const { render, children } = this.props;

    if (!children) {
      this.setState({
        renderedText: '',
        error: '',
      });
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
    }
    return this.state.renderedText || '';
  }
}

export const RenderedText: FC<Omit<Props, 'render'>> = props => {
  const { handleRender } = useNunjucks();

  return <RenderedTextInternal {...props} render={handleRender} />;
};
