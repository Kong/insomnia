// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';

type Props = {|
  el: HTMLElement,
  onUnmount?: () => void,
|};

/**
 * This component provides an easy way to place a raw DOM node inside a React
 * application. This was created to facilitate the layer between UI plugins
 * and the Insomnia application.
 */
@autobind
class HtmlElementWrapper extends React.Component<Props> {
  _setRef(n: ?HTMLDivElement) {
    if (!n) {
      return;
    }

    // Add the element directly to the React ref
    n.innerHTML = '';
    n.appendChild(this.props.el);
  }

  componentWillUnmount() {
    const { onUnmount } = this.props;
    if (typeof onUnmount === 'function') {
      onUnmount();
    }
  }

  render() {
    return <div ref={this._setRef} />;
  }
}

export default HtmlElementWrapper;
