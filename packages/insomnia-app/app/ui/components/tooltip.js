// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import ReactDOM from 'react-dom';

type Props = {
  children: React.Node,
  message: React.Node,
  position: 'bottom' | 'top' | 'right' | 'left',

  // Optional
  className?: string,
  delay?: number
};

type State = {
  visible: boolean
};

@autobind
class Tooltip extends React.PureComponent<Props, State> {
  _showTimeout: TimeoutID;

  // TODO: Figure out what type these should be
  _tooltip: ?HTMLDivElement;
  _bubble: ?HTMLDivElement;

  constructor(props: any) {
    super(props);

    this.state = {
      left: null,
      top: null,
      bottom: null,
      right: null,
      maxWidth: null,
      maxHeight: null,
      visible: false
    };
  }

  _setTooltipRef(n: ?HTMLDivElement) {
    this._tooltip = n;
  }

  _setBubbleRef(n: ?HTMLDivElement) {
    this._bubble = n;
  }

  _handleStopClick(e: MouseEvent): void {
    e.stopPropagation();
  }

  _handleMouseEnter(e: MouseEvent): void {
    this._showTimeout = setTimeout((): void => {
      const tooltip = this._tooltip;
      const bubble = this._bubble;

      if (!tooltip) {
        return;
      }

      if (!bubble) {
        return;
      }

      const tooltipRect = tooltip.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const margin = 3;

      let left = 0;
      let top = 0;
      switch (this.props.position) {
        case 'right':
          top =
            tooltipRect.top - bubbleRect.height / 2 + tooltipRect.height / 2;
          left = tooltipRect.left + tooltipRect.width + margin;
          break;

        case 'left':
          top =
            tooltipRect.top - bubbleRect.height / 2 + tooltipRect.height / 2;
          left = tooltipRect.left - bubbleRect.width - margin;
          break;

        case 'bottom':
          top = tooltipRect.top + tooltipRect.height + margin;
          left =
            tooltipRect.left - bubbleRect.width / 2 + tooltipRect.width / 2;
          break;

        case 'top':
        default:
          top = tooltipRect.top - bubbleRect.height - margin;
          left =
            tooltipRect.left - bubbleRect.width / 2 + tooltipRect.width / 2;
          break;
      }

      bubble.style.left = `${Math.max(0, left)}px`;
      bubble.style.top = `${Math.max(0, top)}px`;

      this.setState({ visible: true });
    }, this.props.delay || 100);
  }

  _handleMouseLeave(): void {
    clearTimeout(this._showTimeout);
    this.setState({ visible: false });

    const bubble = this._bubble;
    if (!bubble) {
      return;
    }

    // Reset positioning stuff
    bubble.style.left = '';
    bubble.style.top = '';
    bubble.style.bottom = '';
    bubble.style.right = '';
  }

  _getContainer(): HTMLElement {
    let container = document.querySelector('#tooltips-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltips-container';
      container.style.zIndex = '1000000';
      container.style.position = 'relative';

      document.body && document.body.appendChild(container);
    }

    return container;
  }

  componentDidMount() {
    // Move the element to the body so we can position absolutely
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().appendChild(el);
    }
  }

  componentWillUnmount() {
    // Remove the element from the body
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().removeChild(el);
    }
  }

  render() {
    const { children, message, className } = this.props;
    const { visible } = this.state;

    const tooltipClasses = classnames(className, 'tooltip');
    const bubbleClasses = classnames('tooltip__bubble theme--tooltip', {
      'tooltip__bubble--visible': visible
    });

    return (
      <div
        className={tooltipClasses}
        ref={this._setTooltipRef}
        onMouseEnter={this._handleMouseEnter}
        onMouseLeave={this._handleMouseLeave}>
        <div
          className={bubbleClasses}
          onClick={this._handleStopClick}
          ref={this._setBubbleRef}>
          {message}
        </div>
        {children}
      </div>
    );
  }
}

export default Tooltip;
